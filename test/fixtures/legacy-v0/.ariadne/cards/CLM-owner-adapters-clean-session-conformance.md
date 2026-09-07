# CLM-owner-adapters-clean-session-conformance: Advertised owner adapters conform in clean sessions

- Status: UNVERIFIED
- Provenance: PROPOSED
- Type: CLM
- Revised: 2026-08-24

## Statement

Every advertised owner adapter implements capabilities, start, resume, cancel, and events against real owner or host boundaries while preserving pins, pointers, authority, cursors, lifecycle, and owner receipt semantics across fresh processes.

## Payload

```json
{
  "dependencies": [
    "DEC-matt-ariadne-adapter-contract",
    "DEC-runtime-safety-recovery-contract"
  ],
  "falsification_conditions": [
    "an advertised operation requires copied owner semantics or hidden session memory",
    "a pin, authority, cursor, cancellation, or receipt invariant fails at the real boundary",
    "fake and production adapter conformance results disagree"
  ],
  "claim_class": "Boundary contract"
}
```
