# HYP-narrow-root-trigger: Specialized root trigger misses general uncertainty

- Status: PROPOSED
- Provenance: PROPOSED
- Type: HYP
- Revised: 2026-08-24

## Statement

The current Ariadne root description emphasizes specialized mechanisms and does not provide a strong semantic trigger for general decision-significant uncertainty.

## Payload

```json
{
  "falsification_conditions": [
    "The current root description reliably activates Ariadne for ambiguous design requests without explicit Ariadne terms."
  ],
  "observations": [
    "OBS-ariadne-flow-missed"
  ],
  "prediction": "An ambiguous design request without explicit Ariadne vocabulary is handled by a downstream skill or ordinary editing before Ariadne artifacts appear.",
  "alternatives": [
    "HYP-missing-epistemic-handoff"
  ],
  "evidence_requests": [
    "EVDREQ-static-uncertainty-coverage"
  ]
}
```
