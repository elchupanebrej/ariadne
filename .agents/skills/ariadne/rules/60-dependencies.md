# Operation 60: Dependencies

## Trigger and purpose

Use Dependencies before changing a core component, schema, boundary, or
deployment unit when the change radius is large or unclear. Dependencies MUST
show which relationships are required by behavior and which are accidental.

## Coupling procedure

1. Record the changed module, candidate mechanism, owner, and invariant.
2. Build a dependency matrix across static, dynamic, data, deployment, event,
   and migration relationships.
3. Trace transitive consumers and providers. Compute the change radius as the
   set of affected modules, schemas, deployments, events, and external
   contracts.
4. Identify the authoritative data owner. A critical datum SHOULD have one
   service owner and an explicit Anti-Corruption Layer at each boundary.
5. Link every critical requirement to the mechanism that enforces it. Mark
   missing links as `UNK-*` or `ASM-*`.
6. Remove accidental co-change coupling only when the required behavior and
   ownership remain explicit.

## High-radius contract

For a high or architectural change radius, the dependency artifact MUST
include a Design Structure Matrix (DSM) covering the coupling classes above.
Apply Parnas information hiding to assign each volatile decision to one module
boundary, and record the resulting boundary contract and owner.

## Coupling classes

| Class | Inspect |
| --- | --- |
| Schema coupling | Tables, fields, IDs, serialization, compatibility, and readers |
| Data ownership | Writers, consistency authority, retention, and reconciliation |
| Deployment coupling | Release order, runtime version, feature flags, and rollback |
| Event coupling | Topics, event order, delivery, retries, and consumer contracts |
| Migration coupling | Backfill, dual-write, read switch, expand/contract, and cleanup |
| Static coupling | Imports, types, build targets, and generated artifacts |
| Dynamic coupling | Calls, queues, locks, timeouts, and failure propagation |

## DEP card

A `DEP-*` card MUST contain the changed component, owner, coupling classes,
direct and transitive dependents, change radius, boundary contracts, required
invariants, and evidence requests. It MUST identify deployment and migration
coupling even when the code diff is local. A dependency is not proof of a
failure; its risk remains `ASSUMED` until evidence supports it.

## Example and gate

Positive: a field rename records every schema reader, event consumer,
deployment version, backfill step, and rollback reader before implementation.

Negative: “Only one service imports this type, so the change is local.” The
statement ignores serialized events, generated clients, deployment order, and
database readers.

The Semantic Gate MUST reject a core change without an owner, change radius,
or contract for each affected coupling class.
