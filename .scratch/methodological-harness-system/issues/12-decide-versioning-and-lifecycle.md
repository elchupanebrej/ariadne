# Decide versioning, propagation, and retirement

Type: grilling
Status: resolved
Blocked by: 03, 04, 05, 09
Parent: [Methodological Harness System](../map.md)

## Question

Which owner, version relationship, change-propagation rule, compatibility policy, review trigger, feedback channel, migration path, and retirement predicate govern the Method Contract, teaching skills, adapters, runtime, worked examples, and self-application receipts as one lifecycle?

## Comments

- Grilling round 1: the user selected independent owner-controlled component versions assembled into an immutable tested release bundle with exact version and digest pins.
- Grilling round 2: the user accepted owner-gated bundle publication and owner-native version identities. Component owners publish versions and compatibility declarations; the harness repository maintainer may only assemble passing receipts. The Method Contract retains its semantic version and format major, packages may use SemVer, evidence artifacts use schema versions and digests, and immutable `b_n` bundle IDs make no compatibility promise.
- Grilling round 3: the user accepted owner-issued change-impact propagation, exact-tuple bundle compatibility, and owner-native feedback. An affected consumer must issue a new version or digest-bound compatibility receipt; ranges are test hints only; cross-component feedback begins at the bundle tracker and remains linked to owner issues.
- Grilling round 4: the user accepted event-triggered review, pin-preserving migration, and evidence-gated retirement. Attempts never change bundle in place; new work moves to the successor while old work drains; retirement disables new execution but preserves historical receipts.
- The user confirmed the complete lifecycle contract as shared understanding.

## Answer

Use a **federated owner lifecycle assembled through immutable Tested Release Bundles**. The Method Contract, Teaching Skills, adapters, kernel, worked examples, and receipts retain their existing owners and version identities; the bundle is a non-normative exact compatibility snapshot, not a release train.

### Ownership and versions

- Component owners alone publish component versions and compatibility declarations. The harness repository maintainer may publish a bundle only when every owner declaration and required evidence receipt passes; it cannot waive or reinterpret them.
- Pin every component by owner-native version and byte digest. The Method Contract keeps its semantic content version and `method-contract/1` format major; packages may use SemVer; examples and receipts use schema versions and digests.
- Reuse immutable `b_n` as the bundle identifier. It is a provenance key, not a compatibility promise. Bundles move through `draft -> active -> deprecated -> retired`.

### Propagation, compatibility, review, and feedback

- Every changed owner emits a Change Impact Receipt naming the changed surface and affected consumers. Each affected owner must publish either a new version or a compatibility receipt bound to the new digest before bundle publication. Unaffected components do not release.
- The harness supports only exact tuples in active or explicitly deprecated bundles. Compatibility ranges and capability declarations select tests but never authorize execution. Direct Matt and Ariadne use remains under their owners' policies.
- Review on normative, schema, capability, or ownership changes; new environment support claims; falsified evidence or safety violations; dependency changes outside declared compatibility; and deprecation deadlines. Do not add calendar review without an observed need.
- Feedback stays in owner-native issue trackers. Cross-component reports start at the bundle tracker and link to owner issues; the harness and bundle store pointers only.

### Migration and retirement

- Never mutate an Orchestration Attempt's pins. New attempts use the active successor; existing attempts drain on the deprecated bundle. Format changes use owner-gated expand-contract overlap.
- If an attempt cannot drain, obtain an owner-approved terminal receipt and start a new attempt. Never reinterpret an ambiguous effect or upgrade an attempt in place.
- Retire only after a successor is active, required migrations and compatibility checks pass, no registered supported consumer or nonterminal attempt references the exact tuple, the deprecation deadline has arrived, owner approvals exist, and the cleanup verification test passes.
- Retirement rejects new execution but preserves historical receipts and bundle manifests for audit. Direct-use retirement remains each component owner's decision.

### Evidence and records

This is a structurally supported lifecycle decision. Existing Rung 6 owner-adapter and clean-session compatibility evidence and Rung 8 recovery fault injection remain required before implementation claims real-boundary support.

- [ADR 0011](../../../docs/adr/0011-federated-lifecycle-through-tested-release-bundles.md) records the architectural trade-off.
- [`DEC-methodological-harness-lifecycle`](../../../.ariadne/GRAPH.jsonl) records the complete accepted contract.
- [`DEP-harness-lifecycle-propagation`](../../../.ariadne/GRAPH.jsonl) records the dependency matrix and change radius.
- [`VAL-SELECT-harness-lifecycle-topology`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory topology selection and adversarial critique.
