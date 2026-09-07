# UNK-orchestration-runtime-ownership: Orchestration runtime ownership boundary

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Should the orchestration runtime be a neutral third subsystem, an Ariadne-owned module, or a host-specific plugin?

## Payload

```json
{
  "outcomes": [
    {
      "value": "neutral third subsystem",
      "effect": "selected provisionally; requires Ariadne validation"
    },
    {
      "value": "Ariadne-owned module",
      "effect": "not selected"
    },
    {
      "value": "host-specific plugin",
      "effect": "not selected"
    }
  ],
  "owner": "user",
  "resolved_by": "DEC-neutral-orchestration-subsystem",
  "resolution": "neutral third subsystem with bounded adapters; physical co-location remains allowed"
}
```
