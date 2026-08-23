# Design the Ariadne Teaching Skill and complete worked example

Type: prototype
Status: resolved
Blocked by: 04
Parent: [Methodological Harness System](../map.md)

## Question

What minimum entry skill, progressive rule routing, complete worked example, artifact set, self-explanation prompts, fading step, and runnable check teach a fresh agent to use Ariadne correctly without copying the Method Contract or loading every rule?

## Comments

- [Throwaway Ariadne teaching-flow prototype](../prototypes/06-ariadne-teaching-flow.throwaway.html) models the proposed task-first sequence and its two source-ownership failure modes; awaiting the required live prototype verdict before resolution.
- User approved the task-first sequence, including worked check before self-explanation, followed by fading and transfer.

## Answer

Use a **thin task-first teaching skill**. It owns lesson order, example fixtures, prompts, fading, transfer, and completion guidance only. Ariadne's live `SKILL.md`, operation rules, graph vocabulary, gates, and evidence ladder remain authoritative; the Method Contract remains the compact normative source. The lesson links paths and stable IDs and never copies either source's normative prose.

### Minimum entry skill

Trigger when a fresh agent must learn or apply Ariadne and has not demonstrated an independent correct route.

1. Present the meaningful task before terminology.
2. Load Ariadne's `SKILL.md` router.
3. If decision-significant uncertainty changes the next action, load `rules/05-uncertainty.md`.
4. Load only the operation rule selected for the current branch. Return to the router when a new branch appears.
5. Load `rules/00-core.md` immediately before graph mutation. Load another cross-cutting rule only when its named concern appears: evidence, invalidation, host roles, depth, or multi-agent invariants.
6. Persist cards and valid links in an isolated example graph.
7. Run the example check and Ariadne's structural, semantic, and epistemic gates.
8. Require self-explanation, one faded case, and one changed transfer case before completion.

Stop on an unresolved decision-significant unknown, invalid graph artifact, evidence below the claim-class rung, any gate failure, copied normative prose, or completion inferred from narrative confidence.

The worked path loads only `SKILL.md`, `05-uncertainty.md`, `10-frame.md`, `00-core.md`, `40-explore.md`, `80-value.md`, `90-validate.md`, and `evidence.md`, each when triggered. It does not preload Diagnose, Transform, Knowledge, Dependencies, Dynamics, Invalidation, Roles, Depth Modes, or Agent Rules.

### Complete worked example

**Task:** A request proposes adding a package to parse `KEY=VALUE` lines. Preserve the existing format, split on the first equals sign, retain later equals signs in the value, reject an empty key or missing delimiter, and add no dependency unless required.

1. **Uncertainty and Frame:** record the parser behavior as required and the package as a proposed mechanism in `FRAME-config-line-parser`.
2. **Explore:** emit `SPACE-config-line-parser` and three candidates:
   - `CAN-first-delimiter-stdlib`: `String.indexOf` plus `slice` inside the parser boundary;
   - `CAN-json-input`: change the representation to JSON;
   - `CAN-environment-boundary`: move ownership to environment input.
3. **Value:** reject JSON because it breaks input compatibility and environment input because it changes ownership. The stdlib candidate is the only eligible mechanism, but remains provisional.
4. **Validate:** create `EVDREQ-config-line-parser-r3` for Algorithmic logic at Rung 3. A Node assertion check covers `A=1`, `TOKEN=a=b`, `=x`, and `NO_DELIMITER`.
5. **Decide:** only a supported `EVD-config-line-parser-r3` permits `DEC-config-line-parser` to lock the stdlib candidate.

The implementation demonstrated by the example is deliberately small:

```js
export function parseLine(line) {
  const delimiter = line.indexOf("=");
  if (delimiter <= 0) throw new Error("invalid config line");
  return [line.slice(0, delimiter), line.slice(delimiter + 1)];
}
```

This Rung 3 receipt supports algorithmic behavior only. It does not support distributed safety, performance, or teaching effectiveness.

### Artifact set

```text
SKILL.md
example/README.md
example/solution.mjs
example/check.mjs
example/.ariadne/GRAPH.jsonl
example/.ariadne/INDEX.md
example/.ariadne/STATE.yaml
```

The example graph contains the Frame, Space, three Candidates, Value selection, Evidence Request, Evidence Result, and Decision named above. `INDEX.md` and `STATE.yaml` are generated views. Do not add a copied router, rule summaries, Method Contract replica, custom schema, course runtime, or dependency.

### Self-explanation, fading, and transfer

Require answers to:

1. Why is the parser package a mechanism rather than a behavioral requirement?
2. Why are JSON and environment input rejected before preference comparison?
3. Why can Rung 3 support this claim but not distributed safety?
4. Why were Diagnose, Transform, Knowledge, Dependencies, and Dynamics not loaded?

For the **faded case**, provide a query-string parser task that must preserve repeated keys and percent decoding. Supply the Frame, three candidates, and hard requirements; withhold the route after Frame, filter verdict, evidence request/result, and decision. Success is an evidence-backed selection of native `URLSearchParams`.

For **transfer**, present duplicate invoices after timeout and retry. The expected route is Uncertainty → Diagnose → Dynamics → Validate with matched evidence. This changed causal and time-dependent shape prevents memorizing the parser route.

### Runnable completion check

```sh
node example/check.mjs && ariadne gate all --strict
```

Completion requires the four parser assertions, a clean isolated graph, an Evidence Result answering the Rung 3 request, an evidence-linked Decision, correct self-explanations, a completed faded case, the correct transfer route, and no source-ownership violation.

### Verification and reopening

- [Throwaway Ariadne teaching-flow prototype](../prototypes/06-ariadne-teaching-flow.throwaway.html) — the complete path passes while bulk-rule loading and copied-contract paths are rejected; SHA-256 `4073099cd9d9d96dcb4f5e5bf937007e197be88fc26cc2b443d28fb5e526be27`.
- [`DEC-ariadne-teaching-skill-contract`](../../../.ariadne/GRAPH.jsonl) records the approved teaching contract.
- [`VAL-SELECT-ariadne-teaching-skill`](../../../.ariadne/GRAPH.jsonl) records the hard-requirement filter and adversarial critique.
- [`EVD-ariadne-teaching-flow-prototype-r3`](../../../.ariadne/GRAPH.jsonl) records the Rung 3 prototype receipt.

Ticket 11 retains clean-session effectiveness and transfer evaluation. Reopen this decision if live Ariadne rules make the path stale, a fresh agent needs oral help, mismatched evidence passes, or a supported host cannot resolve the linked sources.
