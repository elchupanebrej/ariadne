# Decide errors, diagnostics, and repair behavior

Type: grilling
Status: resolved
Blocked by: 04, 07
Parent: [Ariadne production readiness](../map.md)

## Question

What stable error categories and diagnostics must the library and CLI expose for missing data, invalid input, corrupt committed history, recoverable partial writes, lock contention, unsupported formats, permission failures, invariant violations, partial projection failure, timeout, and explicit user-command failure? Decide exit-code policy, machine-readable output, repair guidance, redaction, and which failures must always stop rather than degrade.

## Answer

### Error category vocabulary

Define a flat list of stable `SCREAMING_SNAKE` string constants as the `DiagnosticCode` union. The list is closed at spec time; new codes are compatible minor-version additions per the compatibility policy. No hierarchy or sub-code nesting at this level.

The complete code table, with each code assigned to exactly one exit class:

| Code | Exit | Trigger |
|---|---|---|
| `INVALID_INPUT` | 2 | Schema validation, type mismatch, malformed CLI arguments |
| `MISSING_DATA` | 2 | Required node, edge, or file not found |
| `CORRUPT_PERSISTED_HISTORY` | 2 | Canonical record integrity failure: middle corruption, revision gap, or invariant violation in committed history |
| `INCOMPLETE_TAIL` | 2 | Recoverable incomplete final frame (auto-truncatable per the persistence contract) |
| `UNSUPPORTED_FORMAT` | 2 | Persisted-format version newer than this binary |
| `MIGRATION_REQUIRED` | 2 | Legacy workspace needs explicit migration before mutation |
| `LOCK_CONTENTION` | 2 | Could not acquire root or attempt lock within timeout |
| `LOCK_OWNERSHIP_UNCERTAIN` | 2 | Lock exists, owner PID status ambiguous — fail closed |
| `PERMISSION_DENIED` | 2 | Filesystem permission or containment boundary violation |
| `PATH_ESCAPE` | 2 | Resolved path or symlink escapes the containment boundary |
| `INVARIANT_VIOLATION` | 2 | Internal graph or state invariant broken — programming error |
| `IDEMPOTENCY_CONFLICT` | 2 | Same idempotency key, different payload digest |
| `COMMIT_UNKNOWN` | 2 | Write or sync outcome indeterminate |
| `PROJECTION_RECOVERY_NEEDED` | 1 | Canonical commit succeeded, projection rebuild failed |
| `TIMEOUT` | 2 | Operation exceeded its declared safety cap |
| `COMMAND_FAILED` | 1 | Explicit user command exited nonzero or was killed |
| `GATE_FAILED` | 1 | Gate or verify produced a negative domain verdict |
| `MERGE_DIVERGED` | 1 | Merge completed with unresolved epistemic divergence |

Exit-class rule: `0` = success or help; `1` = valid invocation completed with a negative domain verdict (the operation ran, the domain answer is no); `2` = the operation could not run (invalid input, infrastructure, or integrity failure).

### Stop versus degrade

Every exit-2 code is a full stop — no partial result, no continued mutation. Only exit-1 codes (`PROJECTION_RECOVERY_NEEDED`, `COMMAND_FAILED`, `GATE_FAILED`, `MERGE_DIVERGED`) permit continuation because the canonical operation completed. This follows from the fail-closed principle in the persistence and trust-boundary contracts.

### Library API shape

One base class `AriadneError extends Error` with properties `code: DiagnosticCode`, `message: string`, `repair?: string`, and `detail?: Record<string, unknown>`. No subclasses; callers discriminate via `switch(e.code)` with TypeScript exhaustive matching. `instanceof AriadneError` separates Ariadne errors from unexpected exceptions.

Expected domain outcomes use result discriminants, not thrown errors. Gate, verify, and merge methods return their existing result types with diagnostic arrays. Persistence methods return their four-discriminant result (`not_committed`, `commit_unknown`, `committed`, `committed_with_recovery_needed`). Each public method documents which `DiagnosticCode` values it may throw and which result variants it returns.

Persistence result mapping: `not_committed` carries a specific exit-2 `DiagnosticCode` explaining the cause (e.g., `LOCK_CONTENTION`, `INVALID_INPUT`). `commit_unknown` is thrown as `AriadneError` with code `COMMIT_UNKNOWN` because the caller cannot safely proceed. `committed_with_recovery_needed` is returned as a result carrying `PROJECTION_RECOVERY_NEEDED` diagnostics. `committed` is clean success.

### Diagnostic payload

CLI structured stderr is a JSON object (exit 2) or JSON array of objects (exit 1):

```json
{ "code": "LOCK_CONTENTION", "message": "...", "repair": "...", "detail": { ... } }
```

Fields: `code` (required, `DiagnosticCode`), `message` (required, human-readable), `repair` (nullable, actionable recovery guidance), `detail` (nullable, variable context — path, expected vs. actual format, etc.). All fields follow additive-only evolution per the compatibility policy.

### Relationship to gate and merge diagnostics

`DiagnosticCode` is the operational level (18 codes). Gate diagnostics (`GateDiagnostic` with codes like `TRANSITION_BLOCKED`, `UNVERIFIED_CLAIM`) and merge receipt diagnostics are the domain level, carried inside `detail` (e.g., `detail.gateDiagnostics`). The two vocabularies evolve independently; adding a new gate check does not expand the top-level code list.

### Repair guidance

Three tiers:

**Mandatory repair text**: `LOCK_CONTENTION`, `LOCK_OWNERSHIP_UNCERTAIN`, `UNSUPPORTED_FORMAT`, `MIGRATION_REQUIRED`, `INCOMPLETE_TAIL`, `CORRUPT_PERSISTED_HISTORY`, `PROJECTION_RECOVERY_NEEDED`, `COMMIT_UNKNOWN`.

**Optional repair text** (when context permits): `PERMISSION_DENIED`, `PATH_ESCAPE`, `INVALID_INPUT`, `MISSING_DATA`, `TIMEOUT`.

**No repair text**: `INVARIANT_VIOLATION` (programming error), `IDEMPOTENCY_CONFLICT` (caller bug), `COMMAND_FAILED` (repair is the command's concern), `GATE_FAILED` (repair is the domain's concern), `MERGE_DIVERGED` (repair is `merge-resolve`).

Repair text contract: one to two sentences, imperative mood, references only Ariadne CLI commands or filesystem actions, never contains raw paths or user data. Generated by Ariadne, not requiring redaction.

### Redaction in diagnostics

`message` and `repair` fields contain only Ariadne-generated text and are not redacted. The `detail` field, when it contains fragments of command output or file content, passes through the same best-effort redaction defined by the trust-boundary contract. This is the minimal surface: Ariadne's own diagnostic text is not censored, but external data does not leak unredacted through `detail`.
