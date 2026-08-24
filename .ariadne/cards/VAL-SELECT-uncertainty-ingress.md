# VAL-SELECT-uncertainty-ingress: Select uncertainty ingress and grill substrate

- Status: OPEN
- Provenance: PROPOSED
- Type: VAL-SELECT
- Revised: 2026-08-24

## Statement

Recommend the dedicated uncertainty preflight as Ariadne's core mechanism, preceded by a concise canonical trigger vocabulary; keep a cross-skill wrapper optional and host-specific.

## Payload

```json
{
  "hard_requirements": [
    {
      "name": "decision-significant uncertainty is caught",
      "candidates": {
        "CAN-root-uncertainty-vocabulary": "PARTIAL",
        "CAN-root-uncertainty-preflight": "PASS",
        "CAN-cross-skill-wrapper": "PARTIAL"
      }
    },
    {
      "name": "Ariadne owns epistemic substrate",
      "candidates": {
        "CAN-root-uncertainty-vocabulary": "FAIL_ALONE",
        "CAN-root-uncertainty-preflight": "PASS",
        "CAN-cross-skill-wrapper": "PASS"
      }
    },
    {
      "name": "Matt skills retain their boundaries",
      "candidates": {
        "CAN-root-uncertainty-vocabulary": "PASS",
        "CAN-root-uncertainty-preflight": "PASS",
        "CAN-cross-skill-wrapper": "ASSUMED"
      }
    },
    {
      "name": "works without host-specific adapter",
      "candidates": {
        "CAN-root-uncertainty-vocabulary": "PASS",
        "CAN-root-uncertainty-preflight": "PASS",
        "CAN-cross-skill-wrapper": "FAIL"
      }
    }
  ],
  "preference_criteria": [
    "smallest change radius",
    "one source of truth for substrate fields",
    "progressive disclosure",
    "coverage beyond explicit grill requests",
    "low coupling to Matt invocation details"
  ],
  "independent_observations": [
    "CAN-root-uncertainty-vocabulary has the smallest diff but cannot provide the substrate alone.",
    "CAN-root-uncertainty-preflight separates detection from epistemic confirmation and owns the handoff contract.",
    "CAN-cross-skill-wrapper is deterministic only where host hooks exist and couples Ariadne to Matt skill invocation."
  ],
  "useful_effects": {
    "CAN-root-uncertainty-vocabulary": "Higher root-level recall with minimal text.",
    "CAN-root-uncertainty-preflight": "Reliable epistemic substrate before grilling or delivery handoff.",
    "CAN-cross-skill-wrapper": "Deterministic explicit grill preflight on compatible hosts."
  },
  "harms_and_costs": {
    "CAN-root-uncertainty-vocabulary": "Keyword noise and no substrate contract.",
    "CAN-root-uncertainty-preflight": "One new rule plus fixture tests.",
    "CAN-cross-skill-wrapper": "Host coupling, duplicated trigger logic, and no coverage for non-grill uncertainty."
  },
  "change_radius": {
    "CAN-root-uncertainty-vocabulary": "One root skill file.",
    "CAN-root-uncertainty-preflight": "Root skill, one rule file, tests, and handoff examples.",
    "CAN-cross-skill-wrapper": "Host adapter and cross-skill integration."
  },
  "evidence_rung": 2,
  "adversarial_critique": {
    "CAN-root-uncertainty-vocabulary": [
      "Keyword list may activate for low-value doubt.",
      "It shifts complexity into model interpretation and leaves Matt without graph context."
    ],
    "CAN-root-uncertainty-preflight": [
      "A two-stage route may still miss implicit uncertainty without fixture coverage.",
      "A compact handoff can become a second source of truth unless it links every statement to cards."
    ],
    "CAN-cross-skill-wrapper": [
      "Adapter availability is an unverified host assumption.",
      "Wrapper can make Ariadne dependent on a user-invoked skill that it does not own."
    ]
  },
  "selection": "CAN-root-uncertainty-preflight is the recommended core. Pair it with the smallest useful portion of CAN-root-uncertainty-vocabulary as the model-invoked signal. Do not make CAN-cross-skill-wrapper a core dependency; use it only as an optional adapter if host capability is proven.",
  "unresolved_risks": [
    "UNK-uncertainty-trigger-boundary",
    "UNK-grill-handoff-shape",
    "UNK-auto-handoff-policy"
  ],
  "next_evidence_requests": [
    "Run ambiguous/routine fixture matrix against the root trigger.",
    "Run a grill handoff fixture and verify the next frontier can be reconstructed from linked cards plus the compact summary.",
    "Verify explicit grill requests preflight through Ariadne without auto-invoking to-spec, to-tickets, or implement."
  ]
}
```
