# CAN-merge-sidecar-variants: Sidecar conflict ledger

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Keep the active graph at a safe common state and preserve incompatible variants in a separate deterministic merge-conflict ledger.

## Payload

```json
{
  "mechanism_class": "boundary-owned conflict ledger",
  "separation_principle": "System Boundary",
  "state_owner": "Git integration adapter",
  "known_harm": "Creates a second state surface outside normal graph traversal",
  "rejection_reason": "Creates a second conflict state surface outside the Epistemic Graph."
}
```
