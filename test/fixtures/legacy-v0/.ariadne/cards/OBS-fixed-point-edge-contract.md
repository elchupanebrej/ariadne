# OBS-fixed-point-edge-contract: Fixed-point graph edge rejected

- Status: RESOLVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-24

## Statement

A graph mutation rejected a violates edge targeting a DEC node because that relation does not accept DEC targets; no invalid edge was persisted.

## Payload

```json
{
  "command": "ariadne edge add CAN-live-recursive-self-hosting violates DEC-staged-self-application",
  "error": "violates edges have an invalid target node type",
  "workaround": "Target the governing FRAME requirement and retain the DEC relation as a references edge.",
  "impact": "No invalid mutation; remaining fixed-point substrate can proceed.",
  "component": "Ariadne edge endpoint validation"
}
```
