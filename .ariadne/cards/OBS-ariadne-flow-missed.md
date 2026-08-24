# OBS-ariadne-flow-missed: Observed missed Ariadne flow

- Status: ACTIVE
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-24

## Statement

In the prior session, the agent edited Ariadne documentation but did not run the requested Ariadne reasoning flow before asking frontier questions.

## Payload

```json
{
  "falsification_conditions": [
    "The prior response contains a validated Ariadne graph artifact created before the questions."
  ],
  "source": "conversation",
  "observed_behavior": "Ariadne artifacts were not produced before grilling questions."
}
```
