# VAL-SELECT-matt-ariadne-adapter-contract: Select pointer-only Matt and Ariadne adapters

- Status: SELECTED
- Provenance: DERIVED
- Type: VAL-SELECT
- Revised: 2026-08-24

## Statement

A non-compensatory filter selects pointer-only owner adapters and rejects semantic adapters or an unreceipted direct-call boundary.

## Payload

```json
{
  "hard_requirements": [
    "direct Matt and Ariadne use remains valid",
    "one owner for every workflow, epistemic, host, human, method, and attempt datum",
    "fresh-session invocation, wait, resume, cancel, event, receipt, and error continuity",
    "no inferred replay, compensation, human answer, or graph mutation",
    "host-neutral shared semantics"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-pointer-only-matt-ariadne-adapters",
      "result": "SELECTED",
      "reason": "passes all hard requirements in the Rung 3 state prototype and adds only one shared lifecycle seam"
    },
    {
      "candidate": "semantic orchestration adapters",
      "result": "INELIGIBLE",
      "reason": "duplicates Matt workflow or Ariadne epistemic meaning and expands change radius"
    },
    {
      "candidate": "unreceipted direct host calls only",
      "result": "INELIGIBLE",
      "reason": "cannot establish deterministic fresh-session continuity, cancellation acknowledgment, or generic gates"
    }
  ],
  "preference_criteria": {
    "useful_effect": "machine-checkable lifecycle continuity with direct-use compatibility",
    "mechanism_cost": "five operations plus two owner envelope validators",
    "mutable_state_cost": "attempt metadata and pointers only",
    "infrastructure_cost": "none at contract level",
    "operational_harm": "fails closed rather than replaying or compensating owner effects",
    "cognitive_load": "one shared lifecycle vocabulary",
    "change_radius": "owner volatility terminates at each adapter"
  },
  "selection": "CAN-pointer-only-matt-ariadne-adapters",
  "evidence": [
    "EVD-matt-ariadne-adapter-prototype-r3",
    "OBS-current-matt-bridge-ingest-only"
  ],
  "evidence_rung": 3,
  "assumptions": [
    "real hosts can expose stable start/resume/cancel/event references",
    "Matt owners can emit or approve structured terminal receipts"
  ],
  "unknowns": [
    "real boundary compatibility remains unproven until Rung 6"
  ],
  "adversarial_critique": [
    {
      "attack": "A shared surface hides owner differences.",
      "response": "Owner-specific requests and receipts retain differences; only lifecycle outcomes normalize."
    },
    {
      "attack": "The harness can drift into a second tracker.",
      "response": "Closed pointer-only records forbid semantic payloads and tracker mutations."
    },
    {
      "attack": "Cancellation may be reported before an effect stops.",
      "response": "Intent remains waiting until the owner emits a terminal receipt; ambiguity requires inspection."
    },
    {
      "attack": "The adapter may be needless pass-through code.",
      "response": "The clean-session deletion test must inline or delete it if thinner host-native paths pass."
    }
  ],
  "next_evidence_requests": []
}
```
