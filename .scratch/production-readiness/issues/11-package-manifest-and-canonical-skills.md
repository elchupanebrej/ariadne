# 11 — Package Manifest Realignment and Canonical Skill Bundling

**What to build:**
Configuration of the npm package manifest for release 0.2.0 and packaging of the four canonical agent skills. Updates `package.json` to bump the version to `0.2.0`, locks the Node engine requirement to `"^22.0.0 || ^24.0.0"`, configures the single binary `"ariadne": "dist/cli/index.js"`, and sets the `"files"` allowlist to `dist`, the four canonical skills, `README.md`, and `LICENSE`. Removes the speculative skill `.agents/skills/methodize-harness/`. Bundles exactly four self-contained skills (`ariadne`, `codebase-design`, `grilling`, `domain-modeling`), verifying that each contains an executable `example/check.mjs` test script that exits 0.

**Blocked by:** 10 — Public API Surface Reset and CLI Exit Status Harmonization

**Status:** resolved

- [x] `package.json` version is set to `"0.2.0"`.
- [x] `package.json` `"engines"` is locked to `{ "node": "^22.0.0 || ^24.0.0" }`.
- [x] `package.json` `"bin"` is restricted to `{ "ariadne": "dist/cli/index.js" }`, removing any duplicate binary aliases.
- [x] Speculative skill directory `.agents/skills/methodize-harness/` is deleted.
- [x] Exactly four canonical skills are packaged under `.agents/skills/`: `ariadne`, `codebase-design`, `grilling`, `domain-modeling`.
- [x] Each packaged skill is verified to be completely self-contained with no `../` traversal outside its directory.
- [x] Each of the four skills provides an `example/check.mjs` test script that exits with code 0 and prints `All verification checks passed!`.
- [x] `package.json` `"files"` list explicitly enumerates `dist`, the 4 canonical skill folders, `README.md`, and `LICENSE`.

## Implementation Details

1. **`package.json` Manifest Configuration**:
   - Bumped `version` to `"0.2.0"`.
   - Locked Node.js engine compatibility to `"engines": { "node": "^22.0.0 || ^24.0.0" }` per Section 2.1 of the Production Hardening Specification.
   - Restricted binary field to single binary `"bin": { "ariadne": "dist/cli/index.js" }`.
   - Restricted `"files"` allowlist to:
     ```json
     "files": [
       "dist",
       ".agents/skills/ariadne",
       ".agents/skills/codebase-design",
       ".agents/skills/grilling",
       ".agents/skills/domain-modeling",
       "README.md",
       "LICENSE"
     ]
     ```

2. **Self-Contained Canonical Skills**:
   - Bundled exactly four canonical skills under `.agents/skills/`:
     - `ariadne`: Epistemic reasoning, frontier tracking, and decision validation (`SKILL.md` + 16 rule documents in `rules/`).
     - `codebase-design`: Deep module interface design and seam placement (`SKILL.md`, `DEEPENING.md`, `DESIGN-IT-TWICE.md`, `agents/openai.yaml`).
     - `grilling`: Socratic requirements stress-testing and decision refinement (`SKILL.md`, `agents/openai.yaml`).
     - `domain-modeling`: Ubiquitous language definition and architectural decision records (`SKILL.md`, `ADR-FORMAT.md`, `CONTEXT-FORMAT.md`, `agents/openai.yaml`).
   - Replaced external symlinks with real, self-contained directories.
   - Verified no symlinks or relative references (`../`) escape any skill directory.
   - Confirmed speculative harness skill `.agents/skills/methodize-harness/` is absent.

3. **Executable Verification Checkers (`example/check.mjs`)**:
   - Implemented executable Node.js ES modules using zero external runtime dependencies (`node:assert/strict`, `node:fs`, `node:path`, `node:url`):
     - `.agents/skills/ariadne/example/check.mjs`: Validates `SKILL.md` frontmatter, 16 rule files in `rules/`, routing table branches 0-9, and directory containment.
     - `.agents/skills/codebase-design/example/check.mjs`: Validates `SKILL.md` frontmatter, required documents (`DEEPENING.md`, `DESIGN-IT-TWICE.md`), 8 glossary terms, dependency categories, and local links.
     - `.agents/skills/grilling/example/check.mjs`: Validates `SKILL.md` frontmatter, design tree / rounds / frontier concepts, question format (`❓ **Q`, `➡️`), and termination invariants.
     - `.agents/skills/domain-modeling/example/check.mjs`: Validates `SKILL.md` frontmatter, required documents (`ADR-FORMAT.md`, `CONTEXT-FORMAT.md`), 3 ADR criteria, context formatting templates, and local links.
   - All four checkers exit with code 0 and terminate with `All verification checks passed!`.

4. **Automated Verification Test Suite**:
   - Created [`tests/skills/canonical-skills.test.ts`](../../tests/skills/canonical-skills.test.ts):
     - Asserts `package.json` version `"0.2.0"`, engine `"^22.0.0 || ^24.0.0"`, binary mapping, and exact `"files"` array.
     - Asserts absence of `.agents/skills/methodize-harness/`.
     - Recursively verifies all four skills contain no symlinks and no path escaping.
     - Executes `node .agents/skills/<skill>/example/check.mjs` for each skill and verifies exit 0 and `All verification checks passed!`.
