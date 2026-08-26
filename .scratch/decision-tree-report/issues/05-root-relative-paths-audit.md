# 05 - Task: Root-relative paths invariant across emitted artifacts

Type: task
Status: resolved

## Question

Audit every place where ariadne writes or prints paths outward (evidence receipts in worktree-manager, operational notices, envelope output, ingest messages, status lines) and normalize them to project-root-relative paths (DEC-RPT-06). Internal fs operations stay absolute. Tests: no emitted path starts with `/` or contains an absolute repository prefix.

Independent of tickets 01–04; can be done in parallel.

## Comments

- Audit of outward path emission sites (DEC-RPT-06): report.ts was already root-relative (`cardsPrefix`, `graphPath`, JSON `file`); operational notices and status lines carry no paths; envelope echo adds no repository paths. Fixed: evidence receipt `worktree_path` in worktree-manager, stdout `storage_root` in `ariadne init`, gsd projection (`documents.statePath`/`phaseContextPath`, DEC nodes' `source_path` → also STATE.yaml `gsd_projection.state_path`), GRAPH.jsonl markdown links in handoff/grill-substrate.
- One shared helper `toRootRelative(root, target)` in `src/core/root-relative.ts` (relative + POSIX separators), reused everywhere including replacing report.ts's local `toRepoRelative`. Internal fs operations stayed absolute (worktree handle, document reads, write paths).
- Tests: new checks of emitted-path shape in tests/multiagent/worktree.test.ts, tests/adapters/gsd.test.ts, tests/cli/init-template.test.ts (expectations moved from absolute to root-relative), tests/adapters/handoff.test.ts. No emitted path starts with `/` or contains an absolute repository prefix.
- Checks: vitest 56 files / 577 tests green; `tsc --noEmit` clean; fresh build `tsc -p tsconfig.build.json`; `node dist/cli/index.js gate all --strict` — passed: true, exit 0. Storage formats unchanged (GRAPH.jsonl append-only; STATE.yaml semantics the same, only that field's value became relative).
