# UNK-merge-policy-blocking: Divergence blocking policy

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-08-30

## Statement

Should the first release include an optional strict hook that blocks commits with merge contradictions, or always permit valid DIVERGED results and leave blocking to an explicit CI check?

## Payload

```json
{
  "resolution": "Always permit valid local DIVERGED results; enforce convergence only through explicit CI policy."
}
```
