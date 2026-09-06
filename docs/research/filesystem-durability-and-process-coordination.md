# Filesystem durability and process coordination

Researched 2026-09-06 against primary Node.js, POSIX, Linux, Apple, Microsoft,
and Node-bundled libuv sources. The scope is multiple cooperating Ariadne
processes on one machine using a local filesystem. Network filesystems,
distributed writers, and hostile same-user processes are excluded.

## Decision

Ariadne can provide a portable **process-crash consistency** contract with its
existing file-based substrate:

- one non-recursive `mkdir` lock for every mutation under one `.ariadne` root;
- one validated canonical journal, with all other files treated as rebuildable
  projections;
- serialized journal writes followed by `FileHandle.sync()` before commit is
  reported;
- temp-file replacement for projections, plus containing-directory sync where
  the platform supports it;
- tail framing and recovery that can discard only a demonstrably incomplete
  final transaction;
- automatic stale-lock removal only when the recorded owner process is known
  not to exist. Ambiguous ownership fails closed and requires explicit recovery.

Ariadne cannot truthfully promise universal power-loss durability, a portable
atomic multi-file transaction, or safe time-based lock stealing using only the
documented Node.js filesystem API. Those stronger contracts require a different
persistence or locking substrate.

The public guarantee should therefore be:

> After a mutating call reports committed, another Ariadne process on the same
> running machine can reopen a valid graph containing that transaction. If a
> writer process dies at any point, reopening yields the last valid journal
> prefix and never silently discards a valid later record. Sudden OS, device,
> or power failure is detected and recovered where possible, but persistence of
> the last acknowledged transaction is not guaranteed on every supported local
> filesystem and storage device.

## Guarantee matrix

| Primitive | Portable guarantee in scope | Required synchronization or caveat |
| --- | --- | --- |
| Non-recursive `mkdir(lockPath)` | One cooperating contender creates a previously absent path; others receive an already-exists error. POSIX directory operations are atomic and serializable, and Windows `CreateDirectoryW` reports `ERROR_ALREADY_EXISTS`. | This is acquisition only. Creating `owner` metadata afterward is a second operation, so a crash can leave an ownerless lock. The directory is not a security boundary. |
| Append mode | Each OS appends individual underlying writes rather than intentionally overwriting existing bytes. | Node filesystem calls are not synchronized; `appendFile` is implemented through `writeFile`, which may issue multiple writes. A process can die between them. Serialize the complete logical transaction and validate its final framing. |
| `FileHandle.sync()` | Node requests data and metadata synchronization and reports an error if the platform call fails. | The default `appendFile`/`writeFile` behavior does not flush. `flush: true` uses `sync()` and is available only from Node 20.10.0. An explicit open/write/sync/close sequence avoids coupling the storage contract to that option. |
| Rename/replace | POSIX rename on one filesystem is atomic to observers: the destination is never absent. Node delegates Unix rename to `rename(2)`. | On Windows, Node's bundled libuv calls `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`; Microsoft documents replacement but does not state the POSIX atomicity guarantee. Node does not request `MOVEFILE_WRITE_THROUGH`. Keep temp files in the destination directory, handle rename failures, and validate/rebuild after restart. |
| Directory durability | POSIX specifies atomic live directory operations, not automatic crash durability. Its rationale requires synchronizing the containing directory when the new name must survive a crash. Linux explicitly requires directory `fsync` after a new entry or rename. | Node has no cross-platform directory-sync contract. On Windows, `FlushFileBuffers` requires a handle with `GENERIC_WRITE` and Microsoft does not document it as a directory-entry durability primitive. Treat Unix directory sync as an additional guarantee, not a portable one. |
| Process death | POSIX closes file descriptors and Windows closes kernel-object handles when a process terminates. | Pending I/O can be incomplete; closing a handle is not a substitute for `sync()`. A created lock directory remains because it is a filesystem object, not a handle-owned lock. |
| Stale-owner probe | `process.kill(pid, 0)` is Node's platform-independent existence probe. | It proves existence at that instant, not identity. PIDs can be reused. Only a definite nonexistent result can justify automatic recovery; permission errors, malformed metadata, ownerless locks, and a live reused PID must fail closed. |
| Lock age/mtime | Useful for diagnostics and wait timeouts. | It proves neither death nor loss of ownership. A live process may be paused longer than any timeout, clocks can change, and metadata can be touched. Never delete a lock solely because it is old. |

## Evidence behind the matrix

### Node.js does not serialize file modifications

The Node.js filesystem documentation says its promise and callback operations
are neither synchronized nor thread-safe and warns that concurrent
modifications can corrupt data. It also says `writeFile` is a convenience API
that can perform multiple underlying writes. `appendFile` defaults to flag
`'a'`, and its implementation delegates to that same `writeFile` path. The
`flush` option defaults to false; when true, Node calls `sync()` before closing
the descriptor. See the [Node.js filesystem API](https://nodejs.org/api/fs.html)
and the Node 22 source for
[`appendFile`](https://github.com/nodejs/node/blob/v22.x/lib/internal/fs/promises.js#L1199-L1241).

On POSIX, `O_APPEND` makes positioning at end-of-file and each individual
`write()` one operation, but POSIX still directs applications to use concurrency
control for concurrent regular-file writes. See POSIX
[`write()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/write.html).
On Windows, Node/libuv opens append handles with `FILE_APPEND_DATA`, but
Microsoft states that only a single-sector `WriteFile` is atomic without a
transaction; multi-sector writes are not guaranteed atomic. See
[`WriteFile`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-writefile)
and Node's bundled
[`libuv` open implementation](https://github.com/nodejs/node/blob/v22.x/deps/uv/src/win/fs.c#L413-L590).

Consequently, newline-delimited JSON alone is not a transaction boundary. A
kill can leave a valid JSON value without its newline, half a UTF-8 sequence,
or part of a multi-event operation. A logical mutation needs one framed record
(for example length plus checksum around an event batch), and recovery may
remove only an invalid final frame. Invalid data before that final frame is
corruption and must stop with a diagnostic; truncating everything after the
first bad line can destroy valid history.

### Flush is necessary but not an absolute hardware promise

Node distinguishes `datasync()`, which need not flush unnecessary metadata,
from `sync()`, which requests data and metadata synchronization. The simpler
correct choice for a journal whose length changes is `sync()`. See
[`FileHandle.sync()` and `FileHandle.datasync()`](https://nodejs.org/api/fs.html#filehandlesync).

The mappings are platform-specific:

- Unix libuv calls `fsync`; on Apple it first attempts `F_FULLFSYNC`, then
  `F_BARRIERFSYNC`, then ordinary `fsync`. See Node 22's bundled
  [`libuv` implementation](https://github.com/nodejs/node/blob/v22.x/deps/uv/src/unix/fs.c#L170-L202).
- Windows libuv calls `FlushFileBuffers`. See the bundled
  [`Windows implementation`](https://github.com/nodejs/node/blob/v22.x/deps/uv/src/win/fs.c#L2276-L2293)
  and Microsoft's
  [`FlushFileBuffers`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers)
  contract.

POSIX deliberately leaves the nature of transfer to storage implementation
defined. Apple documents that ordinary `fsync` may leave data in a drive cache
and that even drives can ignore stronger requests. Microsoft likewise notes
that not all hardware honors write-through. See POSIX
[`fsync()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/fsync.html),
Apple's [`fsync(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fsync.2.html)
and [`fcntl(2)`](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/fcntl.2.html),
and Microsoft's
[`CreateFile` caching notes](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew).
The implementation should propagate every sync error, but documentation must
not turn a successful best-effort hardware request into an absolute power-loss
claim.

### Rename gives atomic visibility on POSIX, not portable durability

POSIX requires directory operations to be atomic and serializable while the
system is running and specifies atomic destination replacement for `rename`.
It separately warns that multi-part effects may be only partly present after a
crash. Its rationale gives the standard update sequence: write and sync a temp
file, rename it, then sync the containing directory if the new name must be
durable. See POSIX
[`Directory Operations`](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap04.html),
[`rename()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html),
and the
[`directory durability rationale`](https://pubs.opengroup.org/onlinepubs/9799919799/xrat/V4_xbd_chap01.html).
Linux makes the directory-sync requirement explicit in
[`fsync(2)`](https://man7.org/linux/man-pages/man2/fsync.2.html).

Microsoft documents `MoveFileExW` replacement and a separate
`MOVEFILE_WRITE_THROUGH` flag. Node's bundled libuv uses only
`MOVEFILE_REPLACE_EXISTING`, so Node `rename()` does not request that additional
behavior. See
[`MoveFileExW`](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw)
and the bundled
[`libuv` rename implementation](https://github.com/nodejs/node/blob/v22.x/deps/uv/src/win/fs.c#L2266-L2274).
This is enough to use temp-and-rename for replaceable projections, but not to
claim a portable crash-atomic commit based on rename alone.

### A directory lock coordinates live cooperating processes

Node maps non-recursive `mkdir` to the native operation: Unix `mkdir(2)` and
Windows `CreateDirectoryW`. POSIX says directory operations are atomic and
serializable; Microsoft specifies `ERROR_ALREADY_EXISTS` when the target
directory exists. See Node's bundled
[`Unix mappings`](https://github.com/nodejs/node/blob/v22.x/deps/uv/src/unix/fs.c#L1705-L1725),
[`Windows mapping`](https://github.com/nodejs/node/blob/v22.x/deps/uv/src/win/fs.c#L1288-L1297),
and Microsoft
[`CreateDirectoryW`](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createdirectoryw).

That makes `mkdir` a sufficient acquisition primitive for this scope, but it
does not attach OS-enforced ownership to the directory. The creator must write
validated owner metadata (`schema version`, PID, random token, and timestamps)
for diagnosis. The token must be checked before normal release. Metadata cannot
close the crash gap between directory creation and owner-file creation, so an
ownerless or malformed lock cannot be safely auto-stolen.

POSIX process termination closes file descriptors; Windows process termination
closes kernel-object handles. Neither removes ordinary directory entries. See
POSIX [`_Exit()`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/_exit.html)
and Microsoft
[`Terminating a Process`](https://learn.microsoft.com/en-us/windows/win32/procthread/terminating-a-process).
Node documents `process.kill(pid, 0)` as a cross-platform process-existence
probe, while also warning that a PID can be reassigned. See the
[`process.kill()` contract](https://nodejs.org/api/process.html#processkillpid-signal)
and the
[`ChildProcess.kill()` PID-reuse warning](https://nodejs.org/api/child_process.html#subprocesskillsignal).

The safe stale-lock rule is therefore deliberately conservative:

1. If the owner PID definitely does not exist, quarantine/remove the abandoned
   lock and race to acquire a fresh one.
2. If the PID exists, wait or time out. PID reuse can cause a false busy result,
   but cannot permit concurrent writers.
3. On permission errors, invalid or missing metadata, or any uncertain probe,
   fail closed and provide a diagnostic/manual unlock command.
4. Never use mtime or elapsed wall time as evidence of death.

A timeout may stop waiting and return a stable `LOCK_TIMEOUT` error. It must not
change ownership. Safe automatic lease expiry under arbitrary scheduler pauses
requires fencing: an old owner must be prevented from writing after a new owner
is admitted. Plain files expose no portable conditional write tied to a fencing
token, so a heartbeat-and-delete protocol cannot supply that guarantee.

## Minimal Ariadne persistence protocol

1. Every operation that can change `GRAPH.jsonl`, `STATE.yaml`, `INDEX.md`, or
   `cards/` acquires the same root `.ariadne/.lock`. Reads that can repair data
   acquire it too. The current root lock, graph lock, and state lock must not be
   independent coordination domains.
2. Under the lock, read and schema-validate the canonical journal and validate
   graph invariants before changing anything.
3. Encode the whole logical mutation as one recoverable frame. Append it while
   holding the lock, call `sync()`, and define successful sync as the commit
   point. If the process disappears after sync but before replying, the outcome
   is indeterminate to the caller; retries must be logically idempotent.
4. Generate state, index, and cards from the committed graph. Write each temp
   file in its destination directory, sync it, close it, and rename it. Sync the
   containing directory on POSIX when supported. Projection failure after the
   journal commit is reported as committed-with-recovery-needed, and reopening
   regenerates projections.
5. On open, accept the complete valid journal, discard only a proven incomplete
   final frame, and rebuild projections. Preserve the corrupt bytes or a copy
   for diagnosis. Corruption in the middle is an error, never implicit history
   truncation.

This design avoids needing an atomic transaction across several files. The
journal is the only commit authority; everything else is a cache.

## Guarantees that need another substrate

The production specification must not promise these with the current portable
file protocol:

- survival of every acknowledged transaction across arbitrary power loss on
  every local filesystem, controller, and drive;
- one atomic commit spanning the journal, state, index, and card files;
- safe automatic lock takeover based on a lease timeout while the former owner
  may merely be paused;
- automatic stale-owner identity across reboot and PID reuse using Node core
  alone;
- exclusion of non-cooperating or malicious processes with filesystem access;
- Windows directory-entry durability equivalent to POSIX directory `fsync`.

If any becomes mandatory, use a maintained transactional store such as SQLite
for canonical state and locking, or add a small audited native locking and
durability layer per platform. Do not build a custom lease/fencing protocol on
top of mutable lock files.

## Acceptance evidence required from implementation

- Concurrent subprocesses using every public storage API never overlap their
  critical sections and cannot jointly commit a graph invariant violation.
- Pausing a live owner beyond the wait timeout never allows another writer in.
- Killing the owner before metadata, during journal write, after journal sync,
  during rename, and during projection generation always reopens to a valid
  journal prefix; middle corruption is surfaced without truncation.
- A definitely dead PID is recovered automatically; a live/reused PID,
  malformed owner file, permission failure, and ownerless lock fail closed with
  actionable diagnostics.
- Injected write, sync, close, rename, and directory-sync failures produce the
  documented commit outcome. A committed journal with missing projections is
  rebuilt on reopen.
- Linux, macOS, and Windows integration jobs run the same subprocess crash and
  contention suite on a local filesystem. Separate destructive power-cut tests
  are required before making any stronger platform-specific durability claim.
