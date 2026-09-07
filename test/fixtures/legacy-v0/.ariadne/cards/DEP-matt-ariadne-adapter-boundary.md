# DEP-matt-ariadne-adapter-boundary: Matt and Ariadne adapter dependency boundary

- Status: ACTIVE
- Provenance: PROPOSED
- Type: DEP
- Revised: 2026-08-24

## Statement

The adapter boundary couples the Orchestration Harness only to a five-operation lifecycle protocol and opaque owner pointers; owner-specific adapters absorb Matt skill, Ariadne graph, and host lifecycle volatility.

## Payload

```json
{
  "changed_component": "Orchestration Harness owner-adapter seam",
  "owner": "Orchestration Harness contract owner; each concrete adapter is approved by its source owner",
  "coupling_classes": {
    "schema": "shared request, outcome, capability, and normalized-event envelopes; owner payload schemas remain behind pointers",
    "data_ownership": "harness writes attempt state only; Matt/tracker, Ariadne, host, Method Contract, and humans remain sole writers of their state",
    "deployment": "adapter and source versions are digest-pinned; incompatible versions fail closed",
    "event": "adapter maps owner lifecycle events to normalized status, effect, cursor, receipt, diagnostic, pending-action, and trace pointers",
    "migration": "no compatibility layer until a second real contract version exists; incompatible attempts remain pinned or restart",
    "static": "harness imports only shared envelope types, never Matt or Ariadne semantic types",
    "dynamic": "capabilities, start, resume, cancel, and events; cancellation is intent until owner terminal receipt"
  },
  "direct_dependents": [
    "runtime safety and recovery contract",
    "clean-session verification",
    "versioning and retirement",
    "kernel packaging"
  ],
  "transitive_dependents": [
    "Orchestration Harness implementation",
    "methodology self-harness",
    "host adapters",
    "worked examples"
  ],
  "change_radius": "architectural contract across four remaining Wayfinder decisions",
  "boundary_contracts": [
    "pointer-only shared lifecycle surface",
    "owner-specific request and receipt validators",
    "no cross-owner transaction or compensation",
    "direct use remains valid and may join later through pinned receipts"
  ],
  "required_invariants": [
    "one authoritative owner per datum",
    "no copied workflow or epistemic state",
    "fail closed on unsupported capability, invalid receipt, pin mismatch, or ambiguous effect",
    "terminal cancellation requires owner acknowledgment",
    "Rung 6 conformance before implementation claim"
  ],
  "evidence_requests": [],
  "dsm": {
    "harness": [
      "shared envelope"
    ],
    "matt_adapter": [
      "shared envelope",
      "Matt skill contract",
      "host skill execution"
    ],
    "ariadne_adapter": [
      "shared envelope",
      "Ariadne skill and CLI contract"
    ],
    "host_adapter": [
      "shared envelope",
      "host lifecycle capabilities"
    ],
    "owners": [
      "their own semantic artifacts only"
    ]
  }
}
```
