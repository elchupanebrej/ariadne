# EVDREQ-staged-fixed-point-prototype: Prototype staged fixed-point semantics

- Status: RESOLVED
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-08-24

## Statement

Drive hard cases through the three mechanism classes and the staged state machine to test acyclicity, P/A/R/L equivalence, independent assessment, delta handling, and external-evidence separation.

## Payload

```json
{
  "claim": "UNK-staged-fixed-point-contract",
  "candidate": "CAN-staged-snapshot-fixed-point",
  "claim_class": "Algorithmic logic",
  "minimum_rung": 3,
  "pass_condition": "Only the staged snapshot candidate can reach structural v1 after two independent complete no-delta assessments; normative deltas, disagreement, pin mismatch, or empirical substitution stop the run.",
  "fail_condition": "The prototype permits a cycle, ignores a P/A/R/L delta, releases from one assessment, or counts empirical evidence as fixed-point evidence.",
  "providers": [
    "throwaway deterministic logic prototype"
  ],
  "resolved_by": "EVD-staged-fixed-point-prototype"
}
```
