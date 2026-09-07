# SPACE-kernel-packaging-substrate: Kernel packaging solution space

- Status: EVALUATED
- Provenance: PROPOSED
- Type: SPACE
- Revised: 2026-09-07

## Statement

The packaging space separates stateless reconstruction, Ariadne-owned reuse, neutral co-located file state, and a service-owned database across time, state, operating condition, and system boundary.

## Payload

```json
{
  "dependencies": [
    "FRAME-kernel-packaging-substrate",
    "CTR-minimal-kernel-vs-atomic-continuity",
    "CAN-thin-owner-artifact-baseline",
    "CAN-ariadne-controller-kernel",
    "CAN-colocated-neutral-file-kernel",
    "CAN-standalone-sqlite-kernel"
  ],
  "behavior": "serialize one neutral attempt revision and recover a unique safe disposition without taking owner semantics",
  "hard_invariants": [
    "neutral pointer-only state",
    "durable pre-dispatch intent",
    "fresh-process and concurrent-resumer safety",
    "direct owner use",
    "exact pins",
    "deletable or inlineable kernel",
    "no unproven service or database"
  ],
  "dimensions": {
    "state_owner": [
      "none",
      "Ariadne",
      "neutral kernel",
      "service"
    ],
    "consistency": [
      "reconstruction",
      "Ariadne graph transaction",
      "per-attempt file transaction",
      "database transaction"
    ],
    "execution_mode": [
      "host-only",
      "in-process",
      "one-shot CLI",
      "daemon"
    ],
    "storage": [
      "owner artifacts",
      "Ariadne GRAPH.jsonl",
      "neutral attempt JSONL",
      "SQLite"
    ],
    "failure_boundary": [
      "host session",
      "epistemic graph",
      "single repository attempt",
      "service and database"
    ],
    "deployment_boundary": [
      "none",
      "existing package",
      "co-located module",
      "new service package"
    ]
  },
  "nine_box": {
    "subsystem_past": "GraphStorage already proves lock, partial-tail recovery, and atomic rename for Ariadne events.",
    "subsystem_present": "No neutral attempt ledger exists; AriadneHarnessController owns epistemic integration.",
    "subsystem_future": "The storage pattern can be lifted into a tiny owner-neutral ledger or deleted.",
    "system_past": "Direct Matt and Ariadne use persists owner state without a central runtime.",
    "system_present": "Tickets 03 and 09-12 require atomic intent, exact pins, and pointer-only recovery.",
    "system_future": "A passing thin baseline deletes or inlines the kernel.",
    "supersystem_past": "One trusted local repository and host process are assumed.",
    "supersystem_present": "Clean-session evaluation compares neutral and thin arms.",
    "supersystem_future": "Cross-host evidence, if ever required, may justify a different transaction boundary."
  },
  "candidate_classes": [
    "CAN-thin-owner-artifact-baseline",
    "CAN-ariadne-controller-kernel",
    "CAN-colocated-neutral-file-kernel",
    "CAN-standalone-sqlite-kernel"
  ],
  "pruned_combinations": {
    "Ariadne graph plus neutral schema": "still assigns storage lifecycle and migrations to Ariadne",
    "global file lock": "unnecessarily serializes unrelated attempts",
    "single mutable JSON snapshot": "loses append-only recovery provenance",
    "daemon plus JSONL": "adds process lifecycle without stronger single-host atomicity",
    "SQLite library without service": "new dependency has no proven advantage over the current atomic-file pattern for v1"
  },
  "active_contradictions": [],
  "selection": "CAN-colocated-neutral-file-kernel",
  "fallback": "CAN-thin-owner-artifact-baseline"
}
```
