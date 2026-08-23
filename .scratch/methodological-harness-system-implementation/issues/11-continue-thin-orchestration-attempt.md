# 11 — Continue a thin Orchestration Attempt after a clean-session reset

**What to build:** Let a fresh process or session reconstruct exactly one valid next action for a pinned pointer-only Orchestration Attempt using the thin skill-loader-plus-owner-artifacts path, including an approval wait and later resumption.

**Blocked by:** 09 — Run a Matt skill through the owner lifecycle contract; 10 — Run Ariadne through the shared owner lifecycle contract.

**Status:** resolved

- [x] The attempt retains only its identifier, opaque step, lifecycle status, revision, counter, pins, idempotency key and deadline, replay budget, cursor, cancellation intent, and owner pointers.
- [x] A clean-session reset reconstructs one and only one valid next disposition from declared repository-visible state.
- [x] Approval waiting resumes only from a bound, unexpired owner approval pointer after host permission is revalidated.
- [x] Equal event cursors and digests are idempotent; cursor conflicts or gaps cannot advance the attempt.
- [x] Direct Matt and Ariadne results join through pinned owner receipts without interception or payload copying.
- [x] Cold start, mid-run reset, and approval reset are verified across a real process or session boundary.

## Comments

Implemented the thin skill-loader-plus-owner-artifacts continuation path in `src/harness/attempt.ts`. The attempt ledger persists exactly the declared pointer-only fields to `<root>/attempts/<id>.json`; an explicit field allowlist guards retention. `reconstructNextAction` derives one deterministic disposition per state: terminal → complete; cancellation intent → acknowledge; waiting → approval rules (unbound/expired/corrupt-deadline/permission-unverified-or-lost all escalate fail-closed); running after reset → owner effect inspection; created → dispatch bounded by replay budget. `applyEvent` treats equal cursor+digest as idempotent and throws on conflicts or gaps. `joinDirectResult` pins Matt/Ariadne receipts (and optional file artifacts) as pointers only — no payloads stored. Cold start and mid-run reset are proven across a real child-process boundary (`spawnSync` against the built module); approval reset across a disk-only fresh-load session boundary. 13 tests cover all 6 acceptance criteria.

Known deliberate ceilings (marked with `ponytail:` comments): one `deadline` field serves both dispatch and approval windows; the JSON ledger is single-writer without compare-and-swap. Direct receipts join by becoming pinned owner receipts (matching tickets 09/10 adapters); pre-pinned receipt matching was not required.
