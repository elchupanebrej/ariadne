# CLM-clean-session-validator-quality: Clean-session validators reject critical defects

- Status: UNVERIFIED
- Provenance: PROPOSED
- Type: CLM
- Revised: 2026-08-24

## Statement

The evaluation validators detect at least 85 percent of injected mutations and kill every mutation that would admit undeclared input, invalid evidence, copied owner state, circular proof, an unsafe lifecycle transition, or an incorrect baseline verdict.

## Payload

```json
{
  "dependencies": [
    "CAN-matched-clean-session-evaluation"
  ],
  "falsification_conditions": [
    "mutation score is below 85 percent",
    "any critical isolation, ownership, evidence, lifecycle, or deletion-rule mutant survives"
  ],
  "claim_class": "Test suite quality"
}
```
