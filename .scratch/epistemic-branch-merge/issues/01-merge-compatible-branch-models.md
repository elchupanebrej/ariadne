# 01 — Merge compatible Branch Epistemic Models through Git

**What to build:** Make an ordinary Git merge invoke Ariadne's protocol-v1 three-way semantic merge so compatible Branch Epistemic Models combine deterministically, while invalid or unsafe inputs fail without changing the current-side file.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A real temporary Git repository proves that independent compatible branch changes produce `CLEAN`, return zero, and materialize both deltas.
- [ ] Canonically identical changes deduplicate despite formatting or event-history differences, while a one-sided change becomes active normally.
- [ ] The output retains the common-ancestor bytes and event order, appends only the minimal canonical semantic delta, and is byte-identical across repeated runs and swapped branch roles except for explicitly labeled receipt presentation.
- [ ] Human-readable output and structured Merge Receipts report protocol version, input and output digests, applied and deduplicated subjects, diagnostics, deterministic-detection coverage, and any Post-Merge Verification Requirement.
- [ ] `CLEAN` and `FAILED` receipts remain non-normative caller output and do not append graph events or create a separate merge ledger.
- [ ] Malformed data, schema-invalid or structurally invalid input, protocol incompatibility, and every exceeded hard ceiling return `FAILED`, return non-zero, and leave the current-side bytes unchanged without truncation.
- [ ] Ordinary `git merge` is supported; detected rebase, cherry-pick, revert, or unsupported recursive invocation fails closed with an actionable diagnostic before output changes.
- [ ] Equivalent standalone and GSD workspaces produce the same semantic outcome through the existing workspace resolution boundary.
