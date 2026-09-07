# VAL-SELECT-minimum-orchestration-contract: Select the minimum orchestration boundary

- Status: SELECTED
- Provenance: PROPOSED
- Type: VAL-SELECT
- Revised: 2026-08-24

## Statement

Filter orchestration candidates by the user-selected fresh-session and neutrality requirements, then select the minimal neutral executable kernel as the conditional contract target while retaining the thin baseline as its deletion test and rejecting any standalone service or duplicated semantic owner.

## Payload

```json
{
  "hard_requirements": [
    "repository-visible fresh-session continuation",
    "deterministic stop at HITL, approval, invalid artifact, version mismatch, and ambiguous effects",
    "host-neutral semantics",
    "one owner for every critical datum",
    "direct Matt and Ariadne use remains valid"
  ],
  "candidate_results": [
    {
      "candidate": "prose-only skill and Ariadne CLI",
      "result": "INELIGIBLE",
      "reason": "cannot deterministically enforce lifecycle and artifact gates across fresh sessions"
    },
    {
      "candidate": "host-native implementation of the neutral contract",
      "result": "ELIGIBLE_CONDITIONALLY",
      "reason": "may satisfy the contract for one host if it preserves neutral semantics and repository-visible receipts"
    },
    {
      "candidate": "CAN-dedicated-orchestration-runtime",
      "result": "SELECTED_CONDITIONALLY",
      "reason": "smallest explicit owner for attempt state and cross-session gates; no standalone service is required"
    },
    {
      "candidate": "standalone orchestration service or new agent framework",
      "result": "INELIGIBLE",
      "reason": "adds process, state, and ownership beyond the selected behavior"
    }
  ],
  "selection": "CAN-dedicated-orchestration-runtime",
  "selection_scope": "Contract target and implementation hypothesis only; permanence requires EVDREQ-clean-session-runtime-necessity.",
  "evidence": [
    "EVD-modern-agent-harness-practices",
    "EVD-neutral-orchestration-boundary-r1"
  ],
  "evidence_rung": 1,
  "assumptions": [
    "An owner-controlled Matt invocation and receipt seam can exist without semantic parsing",
    "Repository-backed single-writer attempt state is sufficient for the first implementation"
  ],
  "unknowns": [
    "ASM-dedicated-runtime-necessity",
    "Rung 6 adapter compatibility"
  ],
  "adversarial_critique": [
    "The selected kernel may be only a pass-through and must be deleted if the baseline passes.",
    "A ledger can become a second tracker if it stores workflow meaning.",
    "Host-native features may already supply every lifecycle guarantee.",
    "A standalone service would shift complexity rather than add required behavior."
  ],
  "next_evidence_requests": []
}
```
