# CAN-central-runtime-safety-control: Central orchestration safety control plane

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Let a central orchestration runtime own permission policy, retries, queues, rollback, compensation, telemetry storage, and escalation routing for every owner operation.

## Payload

```json
{
  "mechanism_class": "central workflow and safety control plane",
  "separation_principle": "none",
  "state_owner": "orchestration runtime",
  "supported_invariants": [
    "one operational console",
    "central policy enforcement"
  ],
  "known_violations": [
    "host permission ownership",
    "Matt and Ariadne semantic ownership",
    "human compensation authority",
    "no queue, scheduler, database, or distributed coordinator",
    "direct-use compatibility"
  ]
}
```
