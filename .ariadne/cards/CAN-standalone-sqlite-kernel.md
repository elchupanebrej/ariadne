# CAN-standalone-sqlite-kernel: Standalone SQLite kernel service

- Status: REJECTED
- Provenance: DECIDED
- Type: CAN
- Revised: 2026-09-07

## Statement

Create a separately packaged long-running kernel with a SQLite attempt database, transactions, process API, and lifecycle management.

## Payload

```json
{
  "dependencies": [
    "FRAME-kernel-packaging-substrate",
    "CTR-minimal-kernel-vs-atomic-continuity"
  ],
  "mechanism_class": "service-owned transactional database",
  "operating_principle": "serialize attempts through database transactions and a resident process",
  "separation_principle": "System Boundary",
  "state_owner": "separate Orchestration Harness service",
  "system_boundary": "new package, process, database, IPC/API, deployment lifecycle",
  "supported_invariants": [
    "neutral ownership",
    "transactional concurrency",
    "future multi-process query capability"
  ],
  "known_violated_constraints": [
    "requires a new dependency, service lifecycle, database migration path, and larger deletion surface without a current multi-host requirement"
  ],
  "useful_effect": "strong general transactional substrate",
  "harm": "premature operational system and mutable state",
  "change_radius": "package management, service startup, database schema, IPC, deployment, recovery, and tests",
  "failure_modes": [
    "service unavailable blocks direct local continuation",
    "database/schema lifecycle outlives the kernel need",
    "service becomes a new scheduler or owner"
  ],
  "required_evidence_requests": [
    "EVDREQ-kernel-packaging-prototype-r3"
  ],
  "falsification_predicate": "Rejected for v1 unless file-based single-host transactions fail a hard invariant or cross-host coordination becomes required.",
  "disposition": "Rejected because no current invariant requires a service or database lifecycle.",
  "adversarial_critique": [
    "Transactions are stronger in the abstract, but a package, daemon, database schema, IPC boundary, and migration lifecycle shift complexity into operations without a current cross-host requirement.",
    "Reconsider only if real file-substrate evidence fails a hard invariant or cross-host coordination becomes required."
  ]
}
```
