# EVDREQ-ariadne-teaching-flow-prototype-r3: Check Ariadne teaching-flow completion logic

- Status: ANSWERED
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-09-07

## Statement

The teaching flow must accept the complete progressive path and reject both bulk-rule loading and copied normative content.

## Payload

```json
{
  "claim_class": "Algorithmic logic",
  "minimum_rung": 3,
  "pass_condition": "The deterministic complete path reaches independent status while rule-dump and copied-contract paths are rejected.",
  "fail_condition": "Any invalid path completes or the valid path is blocked.",
  "providers": [
    "throwaway pure reducer prototype"
  ]
}
```
