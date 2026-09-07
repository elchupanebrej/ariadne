# ASM-RPT-01: Why-log reconstructable only if rationale is recorded

- Status: ACTIVE
- Provenance: ASSUMED
- Type: ASM
- Revised: 2026-08-24

## Statement

The why-log reconstructs why only if the rationale is recorded in the card at the moment of choice. Every DEC of this dialogue embeds its justification in the statement.

## Payload

```json
{
  "falsification_conditions": [
    "A DEC appears without rationale in its payload - a log step is left without an explanation"
  ]
}
```
