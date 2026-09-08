# 02 — Storage Root Containment and Path Security

**What to build:**
A robust filesystem containment and path security boundary for all Ariadne filesystem operations. All storage operations, reads, writes, temporary files, and lock acquisitions must be strictly contained within the designated storage root (such as `.ariadne` or `.planning/ariadne`). Paths are canonicalized via realpath resolution, and any symlink or relative path traversal attempting to escape the storage boundary is rejected with `PATH_ESCAPE`. Operating system special files (FIFOs, sockets, device nodes) are rejected with `INVALID_INPUT`, and the `--force` flag is restricted to managed Ariadne projection files.

**Blocked by:** 01 — Unified Diagnostic Vocabulary and Error Model

**Status:** resolved

- [x] Path canonicalization resolves storage roots and target files using realpath resolution before filesystem operations.
- [x] Boundary containment validates that target files, directories, temporary files, and locks reside strictly within the designated storage root.
- [x] Symlink traversal attempting to escape the canonical storage root aborts immediately with `AriadneError(PATH_ESCAPE)`.
- [x] Relative directory traversal (`../` sequences) resolving outside the storage root aborts with `AriadneError(PATH_ESCAPE)`.
- [x] Non-regular files (FIFOs, UNIX domain sockets, character/block devices) are detected and rejected with `AriadneError(INVALID_INPUT)`.
- [x] The `--force` flag is restricted to known managed Ariadne projection files (`STATE.yaml`, `INDEX.md`, cards) and fails closed with `AriadneError(INVALID_INPUT)` if targeting unmanaged files or external code.
- [x] Comprehensive unit tests verify containment enforcement and boundary violation rejections in isolated temporary directories.

## Implementation Details

Implemented the filesystem containment and path security boundary in [`src/core/containment.ts`](../../src/core/containment.ts) with comprehensive unit tests in [`tests/core/containment.test.ts`](../../tests/core/containment.test.ts):

1. **Path Canonicalization (`canonicalizePath`)**:
   - Uses `fs.realpathSync` to dereference symlinks and canonicalize existing paths.
   - For uncreated target paths or directories, traverses upward to find the closest existing ancestor, canonicalizes it via `realpathSync` (following broken symlinks to their intended destination where applicable), and combines it with remaining uncreated path segments.
   - Guards against symlink cycles via loop detection and `ELOOP` interception, aborting with `AriadneError(PATH_ESCAPE)`.
   - Intercepts permission failures (`EACCES`, `EPERM`) and converts them to `AriadneError(PERMISSION_DENIED)`.

2. **Storage Root Boundary Containment (`assertContainedPath`, `isContainedPath`)**:
   - Canonicalizes `storageRoot` and dereferences any symlinks in the root.
   - Resolves target paths (handling absolute paths, root-relative paths, and workspace-relative paths).
   - Enforces that the resolved target canonical path resides strictly within the storage root boundary using delimiter-aware relative prefix checks (handling boundary equality, subpaths, and rejecting prefix-sharing sibling directories).
   - Aborts on any escape (external symlinks, relative traversal `../`, or out-of-boundary paths) by throwing `new AriadneError({ code: "PATH_ESCAPE", message: "...", repair: "Ensure all paths and symlinks reside within the designated storage root." })`.

3. **Special File Detection (`assertRegularFileOrDirectory`)**:
   - Inspects target paths using `fs.statSync` and `fs.lstatSync`.
   - Detects special files (FIFOs, UNIX domain sockets, character devices, block devices).
   - Rejects non-regular files with `new AriadneError({ code: "INVALID_INPUT", message: "Special files (FIFOs, sockets, character/block devices) are not supported", repair: "Ensure storage targets are regular files or directories." })`.
   - Allows non-existent target paths so that new regular files or directories can be staged and created safely.

4. **Safe Overwrite Restrictions for `--force` (`assertSafeForceTarget`, `isSafeForceTarget`)**:
   - Restricts `--force` targets strictly to managed Ariadne projection files: `STATE.yaml`, `INDEX.md`, and cards under `cards/` ending in `.md` (e.g. `cards/*.md`).
   - Rejects unmanaged files within the storage root (e.g. `GRAPH.jsonl`, `NOTICES.jsonl`, `cards` directory, non-markdown files).
   - Rejects external files, source code files (`package.json`, `src/index.ts`), or directory traversals by failing closed with `new AriadneError({ code: "INVALID_INPUT", message: "The --force flag is restricted to managed Ariadne projection files (STATE.yaml, INDEX.md, cards)", repair: "Do not use --force on unmanaged files or source code." })`.

5. **Composite Target Helper (`assertContainedStorageTarget`)**:
   - Provides a combined validation helper verifying both containment within the storage root boundary and regular file/directory constraints in a single call.

6. **Unit Test Coverage (`tests/core/containment.test.ts`)**:
   - 42 tests passing with 100% assertions across isolated temporary directories (`fs.mkdtempSync`).
   - Covers canonicalization of existing and uncreated paths, symlink traversal, broken symlinks, symlink loops, relative and absolute paths, prefix collisions, FIFOs, UNIX domain sockets, character devices, managed projection allowlists, and fail-closed rejections.

