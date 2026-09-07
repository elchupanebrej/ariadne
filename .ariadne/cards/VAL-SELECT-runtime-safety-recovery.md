# VAL-SELECT-runtime-safety-recovery: Select owner-gated runtime safety semantics

- Status: SELECTED_PROVISIONALLY
- Provenance: DECIDED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

A non-compensatory filter selects owner-gated pointer-only safety semantics and rejects both ungated host delegation and a central safety control plane.

## Payload

```json
{
  "owner": "user via confirmed Wayfinder grilling",
  "hard_requirements": [
    "trusted host and workspace with untrusted boundary inputs validated by schema, version, digest, and owner",
    "host alone enforces physical permissions and cancellation",
    "missing approval waits; invalid, expired, mismatched, denied, or broadened authority fails closed",
    "zero replay by default; replay requires owner declaration, stable idempotency key, finite budget, deadline, and one in-flight dispatch",
    "dispatch intent is atomically accepted once per current attempt revision before invocation",
    "owner receipts alone classify committed, no_effect, ambiguous, and terminal cancellation",
    "crash, ambiguity, cursor conflict or gap, lifecycle violation, and expiry never trigger inferred replay or compensation",
    "pointer-only durable transitions are sufficient for a fresh session to recover a unique disposition",
    "observability emits generic correlation and lifecycle events without owner payloads or secrets",
    "every waiting or failed disposition names reason, authority, evidence, pending action, resume predicate, and optional deadline",
    "no queue, scheduler, database, distributed transaction coordinator, rollback engine, alert router, or owner semantic store"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-owner-gated-runtime-safety",
      "result": "PASS_PROVISIONAL",
      "failures": []
    },
    {
      "candidate": "CAN-host-only-runtime-safety",
      "result": "FAIL",
      "failures": [
        "host-neutral deterministic recovery",
        "generic dispatch and event ordering gates",
        "cross-session replay safety"
      ]
    },
    {
      "candidate": "CAN-central-runtime-safety-control",
      "result": "FAIL",
      "failures": [
        "host permission ownership",
        "owner effect and compensation authority",
        "minimal infrastructure and direct-use compatibility"
      ]
    }
  ],
  "preference_observations": {
    "useful_effect": "one deterministic safe disposition after restart, timeout, cancellation, or duplicate delivery",
    "mechanism_cost": "one generic attempt transition contract and owner pointers",
    "mutable_state_cost": "attempt revision, lifecycle metadata, counters, cursor, and pointers only",
    "infrastructure_cost": "no service or queue at contract level",
    "operational_harm": "safe false negatives stop for authority instead of guessing",
    "cognitive_load": "one shared lifecycle and effect vocabulary",
    "change_radius": "runtime contract, owner adapters, clean-session fixtures, and packaging substrate"
  },
  "operating_conditions": [
    "single trusted workspace and host computing base in v1",
    "owner adapters provide schema-valid cursors and effect receipts",
    "no throughput or sustained reliability claim"
  ],
  "evidence_rung": 3,
  "evidence": [
    "EVD-matt-ariadne-adapter-prototype-r3"
  ],
  "assumptions": [
    "real hosts can bind approval pointers to operation inputs and expiry",
    "real adapters can expose stable event cursors, digests, and effect receipts",
    "the packaging substrate can provide atomic compare-and-append without expanding ownership"
  ],
  "unknowns": [
    "Rung 6 boundary conformance",
    "Rung 8 crash and concurrency safety",
    "whether a host-native thin implementation can satisfy the same semantics"
  ],
  "adversarial_critique": [
    {
      "attack": "The attempt record can become a second workflow tracker.",
      "response": "The closed record permits only generic lifecycle fields and opaque owner pointers; owner payload parsing is prohibited."
    },
    {
      "attack": "A hash or schema check cannot make a malicious host trustworthy.",
      "response": "The host and workspace are explicitly the v1 trust root; cryptographic attestation is deferred until an untrusted transport exists."
    },
    {
      "attack": "Zero default retry sacrifices availability.",
      "response": "Availability cannot compensate for duplicate-effect safety; owners may issue finite replay declarations for operations they can make safe."
    },
    {
      "attack": "Atomic dispatch intent does not prove whether a crashed call committed.",
      "response": "It deliberately converts the crash gap to ambiguous waiting and owner inspection rather than guessing."
    },
    {
      "attack": "Expired waiting may discard useful progress.",
      "response": "History and receipts remain; only the expired attempt fails, and a new authorized attempt may import valid owner pointers."
    },
    {
      "attack": "The selected boundary may still be needless code.",
      "response": "Packaging must inline or delete it if the clean-session thin baseline implements every invariant."
    }
  ],
  "selection": "CAN-owner-gated-runtime-safety",
  "next_evidence_requests": []
}
```
