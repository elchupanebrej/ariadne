# 16 — Publish a federated Tested Release Bundle

**What to build:** Let component owners assemble one immutable, non-normative compatibility snapshot from independently versioned Method Contract, Teaching Skill, adapter, example, kernel-disposition, and evidence artifacts, then evolve and retire it without reinterpreting active attempts.

**Blocked by:** 04 — Verify Ariadne fading, transfer, and recovery; 06 — Verify Methodological Guide transfer and recovery; 08 — Verify Harness Authoring transfer and deletion discipline; 10 — Run Ariadne through the shared owner lifecycle contract; 14 — Close the optional Orchestration Kernel branch; 15 — Perform staged self-application and fixed-point verification.

**Status:** resolved

- [x] A bundle pins one exact owner-published version and digest for every component with compatibility evidence for that tuple.
- [x] The bundle is non-normative and preserves owner lifecycle authority, direct capability use, and Method Contract ownership.
- [x] A changed owner emits a Change Impact Receipt naming the changed surface, affected consumers, and required compatibility evidence.
- [x] Publication waits for every affected consumer receipt while unaffected owners retain their version.
- [x] New attempts use the active successor while nonterminal attempts drain under their original pins without in-place upgrade.
- [x] Retirement requires a successor, passed checks, drained consumers and attempts, expired deprecation, approvals, and executable cleanup evidence.
- [x] Historical manifests and receipts remain resolvable after retirement.

## Comments

Implemented the federated bundle registry in `src/harness/release-bundle.ts` with 8 tests (`tests/harness/release-bundle.test.ts`). `assemble` computes real sha256 digests over owner-published bytes, freezes every pin (snapshot survives post-assembly owner edits), rejects duplicate component ids, and requires tuple-level combination evidence plus per-pin evidence before publication. Change flow: the changed OWNER issues a `ChangeImpactReceipt` (issuer and id required; registry records it on the changed bundle and never fabricates statements); `prepareSuccessor` retains unaffected pins verbatim and demands the recorded receipt; publication of a successor waits until every affected consumer has receipted AND each piece of evidence named by the owner is attached to the successor. New attempts register only on active bundles; nonterminal attempts drain under original pins with no in-place upgrade path. Retirement enforces the full gate — active successor, expired deprecation, owner approval, drained attempts, migrated consumers, executable cleanup evidence — and historical manifests plus impact receipts stay resolvable through `get`/`getImpact` after retirement.

Review-driven changes: added tuple combination-evidence requirement (CONTEXT.md definition), made impact receipts owner-issued instead of registry-fabricated (ADR 0011), fixed reason-code/message mismatches (`bundle_id_taken`, `component_not_changed`, `consumers_unmigrated`, `not_active`), froze individual pins, deduplicated `ComponentInput` via `Omit<ComponentPin,"digest">`, stamped the receipt onto the changed bundle so consumer migration is verifiable at retirement, guarded attempt registration to active bundles, ordered `activeBundleId` by publish sequence, and documented the multiple-concurrent-active-bundles ceiling inline.

Note: the thin-path module list in ticket 14's absence check now includes `release-bundle.ts`; the disposition addendum records this amendment.
