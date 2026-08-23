---
name: teach-ariadne
description: Teach a fresh agent to use Ariadne through a task-first progressive reasoning flow.
disable-model-invocation: true
---

# Ariadne Teaching Skill

Teach a fresh agent to use Ariadne without preloading unrelated rules or copying the Method Contract or Ariadne's normative prose.

## Learning Path

1. **Meaningful Task First**: Present the concrete task before terminology.
2. **Router**: Load Ariadne's router at `.agents/skills/ariadne/SKILL.md`.
3. **Uncertainty Ingress**: If decision-significant uncertainty changes the next action, load `.agents/skills/ariadne/rules/05-uncertainty.md`.
4. **Framing**: Load `.agents/skills/ariadne/rules/10-frame.md` and `.agents/skills/ariadne/rules/00-core.md`. Frame behavior independently from proposed mechanisms.
5. **Explore**: Load `.agents/skills/ariadne/rules/40-explore.md`. Explore at least 3 structurally distinct candidates.
6. **Value**: Load `.agents/skills/ariadne/rules/80-value.md`. Filter candidates against hard requirements before preference scoring. Emit an Evidence Request.
7. **Validate**: Load `.agents/skills/ariadne/rules/90-validate.md` and `.agents/skills/ariadne/rules/evidence.md`. Run executable checks and emit matched Evidence Result before locking a Decision.
8. **Self-Explanation**: Answer the 4 why-questions citing live sources after runnable checks pass.
9. **Faded Practice**: Complete the faded case (URL query parsing) without route scaffolding.
10. **Transfer**: Route a changed-structure transfer case (duplicate invoices -> Uncertainty -> Diagnose -> Dynamics).

## Complete Worked Example: Config-Line Parser

- **Task**: A request proposes adding a package to parse `KEY=VALUE` lines. Preserve the existing format, split on the first equals sign, retain later equals signs in the value, reject an empty key or missing delimiter, and add no dependency unless required.
- **Directory**: `example/`
- **Solution**: `example/solution.mjs`
- **Verification**: `node example/check.mjs`
- **Graph**: `example/.ariadne/GRAPH.jsonl`

## Self-Explanation Prompts

After the runnable check passes, the learner must answer:

1. **Mechanism vs Requirement**: Why is the parser package a mechanism rather than a behavioral requirement?
   - *Basis*: Cites `.agents/skills/ariadne/rules/05-uncertainty.md` & `10-frame.md`.
2. **Hard-Requirement Filtering**: Why are JSON and environment input rejected before preference comparison?
   - *Basis*: Cites `.agents/skills/ariadne/rules/80-value.md`.
3. **Evidence Rung Scope**: Why can Rung 3 support this claim but not distributed safety?
   - *Basis*: Cites `.agents/skills/ariadne/rules/evidence.md`.
4. **Progressive Rule Loading**: Why were Diagnose, Transform, Knowledge, Dependencies, and Dynamics not loaded?
   - *Basis*: Cites `.agents/skills/ariadne/SKILL.md`.

## Faded Practice Case

- **Task**: Provide a query-string parser task that must preserve repeated keys and percent decoding. Supply the Frame, three candidates, and hard requirements; withhold the route after Frame, filter verdict, evidence request/result, and decision.
- **Expected Outcome**: Evidence-backed selection of native `URLSearchParams` at Rung 3.

## Transfer Case

- **Task**: Present duplicate invoices observed after a network timeout and retry loop.
- **Expected Route**: `Uncertainty` (`05-uncertainty.md`) -> `Diagnose` (`20-diagnose.md`) -> `Dynamics` (`70-dynamics.md`) -> `Validate` (`90-validate.md` + `evidence.md`).
- **Goal**: Prevent memorizing the parser route by introducing causal and time-dependent dynamics.

## Runnable Completion Check

From the repository root:

```sh
npm run build && node .agents/skills/teach-ariadne/example/check.mjs
```

The check runs the parser assertions and graph integrity checks, then invokes
the built CLI (`gate all --strict`) against `example/.ariadne/GRAPH.jsonl`.
