# CAN-colocated-neutral-file-kernel: Co-located neutral file kernel

- Status: SELECTED
- Provenance: DECIDED
- Type: CAN
- Revised: 2026-09-07

## Statement

Add one owner-neutral TypeScript module beside the current source, invoked in-process or by a one-shot CLI, with a separate per-attempt JSONL ledger protected by directory locking, expected revisions, temp-file rewrite, and atomic rename.

## Payload

```json
{
  "dependencies": [
    "FRAME-kernel-packaging-substrate",
    "CTR-minimal-kernel-vs-atomic-continuity",
    "OBS-existing-ariadne-harness-seam"
  ],
  "mechanism_class": "in-process revisioned file ledger",
  "operating_principle": "persist intent before dispatch and materialize disposition from an append-only attempt log",
  "separation_principle": "State/Data",
  "state_owner": "Orchestration Harness only",
  "system_boundary": "src/orchestration/ plus repository .orchestration/ state",
  "supported_invariants": [
    "neutral pointer-only state",
    "atomic dispatch intent",
    "fresh-process recovery",
    "no daemon or database",
    "direct use",
    "single-directory deletion or later inlining"
  ],
  "known_violated_constraints": [],
  "useful_effect": "adds the minimum missing atomic continuation seam using proven project primitives",
  "harm": "adds one module and one repository state directory",
  "change_radius": "new neutral module, export or one-shot command, adapter callers, and clean-session fixtures",
  "failure_modes": [
    "filesystem without atomic same-volume rename",
    "stale lock policy mishandles a live slow process",
    "unbounded per-attempt log without later compaction"
  ],
  "required_evidence_requests": [
    "EVDREQ-kernel-packaging-prototype-r3"
  ],
  "falsification_predicate": "Reject or deepen the substrate if a single-host fault test loses a committed log entry, admits two intents at one revision, or cannot recover after a partial tail.",
  "adversarial_critique": [
    "The module duplicates file-storage mechanics and may be unnecessary; extract no abstraction until implementation proves duplication, and delete the module if the matched thin baseline passes.",
    "Per-attempt JSONL and stale-lock recovery remain filesystem assumptions until Rung 8 fault injection validates them."
  ]
}
```
