# UNK-merge-topology-policy: Topology divergence policy

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-08-30

## Statement

When two valid branch deltas jointly create a cycle or dangling reference, should Ariadne quarantine the conflicting delta and complete Git merge, or surface a hard Git conflict?

## Payload

```json
{
  "resolution": "Quarantine combined topology violations and return DIVERGED."
}
```
