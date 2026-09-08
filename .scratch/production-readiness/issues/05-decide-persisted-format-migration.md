# Decide persisted-format evolution and migration

Type: grilling
Status: resolved
Blocked by: 04
Parent: [Ariadne production readiness](../map.md)

## Question

How are every authoritative persisted format and derived projection versioned, detected, upgraded, backed up, and rejected when too new or corrupt? Decide whether migration is automatic or explicit, whether upgrades are reversible, how interrupted migration resumes, which history must be retained, and what evidence proves that an existing `.ariadne` workspace reaches the new format without semantic or event loss.

## Answer

Give each canonical authority and derived projection an independent positive integer persisted-format version. A missing version is legacy v0. Persisted-format versions are distinct from the npm package version, Merge Protocol Version, and owner bundle versions. Version the graph history, notice history, state, index/cards projections, and pointer-only Orchestration Attempt ledgers independently so an unrelated format change does not force an unrelated migration.

Migration is explicit and user-invoked. A legacy workspace may be inspected read-only, but mutating operations refuse to run until its migration succeeds. A dry run reports detected formats, source digests, target versions, projected changes, and any blocking diagnostic without writing. The migration command acquires the same locks as normal persistence, validates every source authority in full, and creates an immutable digest-verified backup containing canonical inputs and relevant projections before producing any successor files.

The migration manifest records a migration ID, source and target format versions, source digests, target digests when known, backup location, and checkpoints. Successor files are built in staging, validated against schemas and graph/ledger invariants, and regenerated projections are checked against the migrated canonical records. The successor set is not active until the manifest marks migration complete. On restart, an incomplete migration resumes only when source and backup digests still match; otherwise it fails closed and requires explicit repair. Readers never consume a mixed old/new authority set. Rollback is an explicit operation that restores the verified backup, and backups are retained until explicit cleanup.

Legacy v0 graph and notice records are parsed and emitted in their original order as equivalent versioned records; no event, ID, edge, notice, pointer, or revision is dropped. State migration preserves valid adapter-owned overlay fields. Attempt migration preserves lifecycle history, pins, cursors, idempotency keys, deadlines, and owner pointers without changing active attempt ownership or semantics. Projections may be regenerated, but they are never used to repair or replace canonical history.

An unsupported newer version produces a stable `UNSUPPORTED_FORMAT` diagnostic and leaves the workspace read-only. Corrupt canonical data, invalid revision chains, semantic loss, or a digest mismatch produces `CORRUPT_PERSISTED_HISTORY` or a specific migration-integrity diagnostic and fails closed. Only the incomplete-final-tail recovery already defined by the persistence contract is automatic; canonical middle corruption is never silently truncated. Corrupt projections may be rebuilt only after canonical records validate.

Acceptance requires one fixture for every supported legacy authority and projection, semantic round-trip equality, event/order/ID/edge/revision/pointer preservation, overlay preservation, backup restore, interrupted-migration recovery at each checkpoint, mixed-version rejection, too-new rejection, corruption rejection, and clean migration across the supported runtime matrix. Existing `.ariadne` history remains available through the retained backup even after a successful upgrade.
