# 16 — Fail-closed classes, priority order, tie-breaks, blocked diagnostic

**What to build:** The continuation projection from ticket 15 now covers every readiness class with a deterministic fail-closed-first priority order. A fresh session on a frame with an active contradiction is directed to resolve it before anything else; an outstanding evidence request directs the pinned method execution; an unmet dependency names the deepest unsatisfied dependency as `missingDeps`; a fully blocked frame receives a structured diagnostic (severity, code, message, target, fix) and no recommendation. Ties break deterministically (frame `derived_from` order, then lexicographic node id) — the response returns the first action and lists the runner-up in `unlocks`, never two actions.

**Blocked by:** 15 — Frame continuation skeleton (ready + insufficient-information).

**Status:** resolved

- [x] `blocked-contradiction`: active contradiction node with a contradicts edge to a live proposition, or merge-conflict status → resolve contradiction first; no other operation recommended.
- [x] `blocked-evidence`: active evidence request not answered by a SUPPORTED evidence result, or required_rung above the highest answering rung → execute the pinned method and record the evidence result.
- [x] `blocked-dependency`: non-terminal candidate with a non-terminal, non-superseded dependency → advance or satisfy the deepest unsatisfied dependency; response names it as `missingDeps`.
- [x] `blocked` outcome: every candidate path crosses an unresolved contradiction, invalidated/superseded node, or missing owner receipt → structured diagnostic (severity, code, message, target, fix), no recommendation.
- [x] Fail-closed priority order enforced: blocked-contradiction → blocked-evidence → blocked-dependency → ready → insufficient-information.
- [x] Deterministic tie-breaking: frame `derived_from` order, then lexicographic node id; runner-up listed in `unlocks`.
- [x] Table-driven tests extended: one case per new class, priority-order cases (contradiction outranks outstanding evidence), tie-break cases, diagnostic envelope, and an absent/unknown frame id case.

## Comments

Parent spec: `specs/graph-native-continuation-and-package-repair.md`. On passing the table-driven Rung 3 check, the continuation contract becomes lock-eligible (ticket 19).
