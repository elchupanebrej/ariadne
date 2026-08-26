# Research: Portability of the three teach/methodize skills

Research ticket: `.scratch/installable-skills/issues/09-teach-skills-portability.md`
Date: 2026-08-25. Local analysis only — every claim below was verified by reading the skill directories at `.agents/skills/{methodize,methodize-harness,methodize-ariadne}/` and running each `example/check.mjs` with plain Node.

**Naming correction first:** the ticket names `teach-ariadne`, `teach-harness`, `teach-methodology`. Those directories no longer exist; they were renamed to `methodize-ariadne`, `methodize-harness`, and `methodize` respectively (descriptions match one-to-one; e.g. `methodize/SKILL.md` describes "Routes to Ariadne usage, orchestration harness design, or Methodological Guide authoring"). This analysis covers the current directories. One stale pre-rename artifact survives inside a fixture (noted below).

---

## Skill 1: `methodize-ariadne` (ticket name: `teach-ariadne`)

### Files analyzed

| File | Role |
|---|---|
| `SKILL.md` | Lesson: teach Ariadne usage via config-line-parser worked example |
| `example/check.mjs` | Parser assertions + graph-integrity check + strict CLI gate |
| `example/solution.mjs` | 8-line parser implementation |
| `example/README.md` | Example walkthrough |
| `example/teaching-transcript.md` | Full cold-start teacher+learner session (194 lines) |
| `example/.ariadne/{GRAPH.jsonl,INDEX.md,STATE.yaml}` | Example graph data |

### Q1 — External dependencies

1. **Ariadne skill, by repo-root path** — `SKILL.md:14-19` loads `.agents/skills/ariadne/SKILL.md` and rules `05-uncertainty.md`, `10-frame.md`, `00-core.md`, `40-explore.md`, `80-value.md`, `90-validate.md`, `evidence.md`; self-explanation bases repeat them (`SKILL.md:47-53`); transfer case adds `20-diagnose.md`, `70-dynamics.md` (`SKILL.md:63`). The transcript cites the same paths ~15 times (e.g. `teaching-transcript.md:29,75,81,92,178-185`). All exist in this repo under `.agents/skills/ariadne/rules/` — but the `ariadne` skill is *not part of the published trio*, and the paths assume installation at `<repo-root>/.agents/skills/ariadne/`.
2. **This repo's npm package + built CLI** — `SKILL.md:71`: completion check is `npm run build && node .agents/skills/methodize-ariadne/example/check.mjs` "from the repository root"; `check.mjs:46-51` spawns `../../../../dist/cli/index.js gate all --strict` (four levels up = repo root). Requires the `ariadne` CLI built from this repo's source.
3. **Authoring-session temp file** — `teaching-transcript.md:14` references `node /tmp/opencode/urlparams-check.js`; that file exists only on the author's machine (mitigated by "recreate if absent").
4. **Repo-root-relative self-reference** — `SKILL.md:71` and `teaching-transcript.md:13` invoke the check via `.agents/skills/methodize-ariadne/example/check.mjs`, assuming that exact mount point.

No GSD-skill, `.planning/`, or `.scratch/` references.

### Q2 — What breaks standalone vs what works

Breaks immediately:
- Learning Path steps 2–7 and the transfer case: every load target is a dead path (no `.agents/skills/ariadne/` in a foreign environment).
- The Runnable Completion Check: no repo root, no `npm run build`, no `dist/cli/index.js`. Verified here that the check passes only because this repo's `dist/` exists; the final gate step (`check.mjs:45-52`) cannot succeed standalone.
- Self-explanation prompts demand citations of rule files the learner cannot open.

Works as-is:
- The core pedagogy (task-first framing, faded practice, transfer descriptions) reads fine as prose.
- `solution.mjs` is self-contained; `example/.ariadne/*` are inert data; `check.mjs` steps 1–3 (parser assertions + graph integrity over bundled JSONL) run anywhere Node runs — only the last step (CLI gate) fails.

### Q3 — Verdict: **needs edits** (heaviest of the three)

Must change before publication:
- Rewrite all `.agents/skills/ariadne/...` references to a portable form (sibling-relative paths, or an explicit prerequisite note "install the `ariadne` skill first" with name-based lookup) — affects `SKILL.md` lines 14–19, 47–53, 63 and ~15 transcript locations.
- Gate or remove the CLI step: `SKILL.md:68-75` and `check.mjs:45-52`. Options: make the strict gate conditional ("skip if no ariadne CLI available"), or drop it and keep the self-contained graph assertions.
- Fix transcript line 14 (`/tmp/opencode/urlparams-check.js`) — inline the command or delete the line.

Alternative disposition: declare a hard prerequisite "publishes only alongside the `ariadne` skill", which still leaves the CLI-gate edit mandatory.

---

## Skill 2: `methodize-harness` (ticket name: `teach-harness`)

### Files analyzed

| File | Role |
|---|---|
| `SKILL.md` | Lesson: design orchestration harness from continuation failure |
| `bootstrap.lock` | sha256 pins of lesson sources |
| `references/harness-research.md` | Architecture principles reference (18 lines) |
| `example/check.mjs` | Fixture validation + 6 deterministic invariant paths |
| `example/input/dependency-review-run.json` | Failure-trace input fixture |
| `example/solution/harness-project.json` | Worked solution |
| `example/README.md` | Example walkthrough |

### Q1 — External dependencies

1. **Repo-relative pins in `bootstrap.lock`** — pins target `docs/designing_methodological_guides.md` (G_n), `src/method-contract/schemas.ts` (M_n-engine-schemas), and notably `.agents/skills/methodize/SKILL.md` (pin `MA_n`, i.e. a *dependency on the sibling published skill*) (`bootstrap.lock:8,15,22`). Only the `harness-research` pin is marked "(skill-relative)" (`bootstrap.lock:27-33`).
2. **Stale pre-rename identifiers in the fixture** — `example/solution/harness-project.json:12,310` contain `"sha256:teach-methodology-skill-v1"` and `file://docs/designing_methodological_guides.md` (content-level references; `check.mjs` only asserts the digest strings are present, never resolves them).
3. **Conceptual ecosystem references** — `SKILL.md:18` assigns responsibilities to "Tracker (Matt skills)" and Ariadne; `references/harness-research.md:11-13` repeats the owner taxonomy. These are prose concepts, not file paths — they degrade gracefully.
4. `SKILL.md:11` explicitly states its own fixtures resolve skill-relative — correct and honored.

No GSD-skill, `.planning/`, or `.scratch/` references.

### Q2 — What breaks standalone vs what works

Breaks / degrades:
- Learning step 2 ("resolve and validate exact `G_n`, `M_n`, `MA_n`, … digests") is unperformable: the pinned repo files don't exist outside this repo, so pin verification fails by design (fail-closed, ironically per the skill's own principle).
- Self-application transfer (`HA_n` builds `OH_n` … `M_n`) presumes the `methodize` skill is present (pinned as `MA_n`).

Works as-is:
- **The entire runnable layer**: verified `node example/check.mjs` passes with zero non-node-stdlib imports; it checks only files inside the skill folder (`check.mjs:17-24`).
- Prose lesson, research reference, fixtures, README — all self-contained.

### Q3 — Verdict: **needs edits (small)**

- Rewrite or annotate `bootstrap.lock` pins: either ship the pinned artifacts (the guide doc, schemas.ts, sibling SKILL.md) in the package, or mark repo-only pins as "verify only when running inside the source repo".
- Cosmetic: update `sha256:teach-methodology-skill-v1` → post-rename identifier in `harness-project.json` (two spots), since publishing under new names with old-name digests invites confusion.

Mechanically it already installs and verifies clean.

---

## Skill 3: `methodize` (ticket name: `teach-methodology`)

### Files analyzed

| File | Role |
|---|---|
| `SKILL.md` | Router to the two lessons + own Methodological-Guide-authoring lesson |
| `bootstrap.lock` | sha256 pins (guide doc + 4 engine files) |
| `example/check.mjs` | Guide-project validation incl. fail-closed invalid paths (185 lines) |
| `example/input/dependency-change.json` | PR-review input fixture |
| `example/solution/guide-project.json` | Worked guide project |
| `example/receipts/external-verification.json` | External verification receipts fixture |
| `example/README.md` | Example walkthrough |

### Q1 — External dependencies

1. **Sibling skills by repo-root path** — routing table sends learners to `.agents/skills/methodize-ariadne/SKILL.md` and `.agents/skills/methodize-harness/SKILL.md` (`SKILL.md:17-18`). Correct in this repo; wrong wherever a host installs skills into its own directory layout.
2. **Repo-local guide doc, five times** — self-explanation bases cite `docs/designing_methodological_guides.md#expansion-guide|#working-card|#epistemology|#fixed-point|#chapter-16` (`SKILL.md:54-62`); the contract demands citing "live sources". That doc is a 117 KB file in *this* repo.
3. **Repo-relative pins** — `bootstrap.lock:8,15-36` pins the same guide doc plus four `src/method-contract/*.ts` engine files (index/schemas/types/validator), all `"version": "repo"`.
4. **Path-shaped strings in fixtures** — `guide-project.json` rationale_refs all match `^docs/designing_methodological_guides\.md#…` (enforced by `check.mjs:41`); `input/dependency-change.json:20` has `file://docs/policy/approved-licenses.md`. These are data, never opened by the check.
5. `input/dependency-change.json:14-16` lists `npm test` / `npm run build` / `npm audit` as illustrative verification commands within the fictional review scenario — not executed.

No GSD-skill references.

### Q2 — What breaks standalone vs what works

Breaks / degrades:
- Routing rows for the two sibling lessons: dead paths in any foreign install.
- Pin-validation learning step (step 2) unperformable, same as harness.
- Self-explanation steps instruct citing sources the learner doesn't have (the guide doc). Lesson remains followable but its epistemic discipline ("cite live sources") is hollowed out.

Works as-is:
- Verified `node example/check.mjs` passes with only node stdlib; it asserts *string values* about the guide doc but never reads the file (`check.mjs:9-17,41`), so the whole worked example, including the six invalid-path rejections and metamethodology acyclicity checks, runs cleanly anywhere.
- The methodology-authoring lesson proper (steps 1–12, faded practice, transfer) is fully self-contained prose.

### Q3 — Verdict: **needs edits (small)**

- Make the router rows portable: sibling-relative (`../methodize-ariadne/SKILL.md`) or name-based ("load the skill named `methodize-ariadne`"), and state what to do if a sibling isn't installed (the third row — continue below — already covers the fallback).
- Decide the fate of the guide-doc citations + `bootstrap.lock` pins: ship `docs/designing_methodological_guides.md` alongside, or reword the five "Basis" lines to not promise a readable source.
- Optional: relax `check.mjs:17,41`'s hardcoded doc path only if the doc ships under a different name.

---

## Shared dependency patterns across the trio

1. **Repo-root-absolute internal paths are the universal breakage vector.** Every skill mixes two conventions: its *own* fixtures are correctly skill-relative (both lock files even say "Paths are relative to the repository root unless marked skill-relative"; `methodize-harness/SKILL.md:11` and `methodize/SKILL.md:23` call this out explicitly) — but every *cross-artifact* reference (ariadne rules, sibling skills, `docs/`, `src/`) uses repo-root paths that only resolve inside this repository.
2. **`bootstrap.lock` encodes this monorepo's shape.** All three locks (well: two locks; methodize-ariadne has none) pin `docs/…`/`src/…` paths with real sha256s, which is exactly right for in-repo teaching and exactly wrong for distribution. Harness additionally pins its sibling skill (`MA_n` → `.agents/skills/methodize/SKILL.md`), so the publish set is coupled, not independent.
3. **Runnable checks are almost perfectly portable.** Two of three `check.mjs` scripts import only `node:*` and touch only in-package files — verified green standalone. The single exception is `methodize-ariadne/example/check.mjs:46`, which shells out to this repo's built CLI (`dist/cli/index.js gate all --strict`). One-line-per-file fixes (conditional gate, path fix) would make all three verify cleanly anywhere.
4. **Rename residue.** Directories went `teach-*` → `methodize*`, and `SKILL.md`/`check.mjs`/transcript consistently use new names — except `harness-project.json:12,310` still carries `sha256:teach-methodology-skill-v1`. Ticket 09's premise (paths `teach-*`) is likewise outdated.
5. **Hidden fourth dependency: the `ariadne` skill itself.** `methodize-ariadne` teaches *how to use* the `ariadne` skill via hardcoded paths to it, and the harness lesson assigns Ariadne an owner role. Publishing the trio without the `ariadne` skill (and, for full fidelity, the guide doc) leaves one lesson pathless and one lesson conceptually incomplete.
