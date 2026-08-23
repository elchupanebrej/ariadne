# Decide clean-session verification and evaluation

Type: grilling
Status: resolved
Blocked by: 05, 06, 07, 08, 09, 10
Parent: [Methodological Harness System](../map.md)

## Question

Which clean-session tasks, artifact assertions, Ariadne evidence rungs, failure injections, reviewer checks, and comparison baseline prove that the skills and Orchestration Harness teach and execute the methods without hidden author context?

## Comments

- Grilling round 1: the user accepted separate teaching, orchestration, and hidden-context claims; manifest-audited clean-session isolation; matched source-only and thin-harness baselines; claims bounded to tested host/model/adapter combinations; and non-compensatory pass semantics.
- Grilling round 2: the user accepted held-out faded and changed-transfer tasks with two isolated runs per tested combination; contract-driven artifact assertions; Rungs 2, 3, 5, 6, and 8 by claim class; independent safety-boundary fault injections; deterministic checks before blinded review; and deletion or inlining whenever a matched thinner baseline passes. This completed the design tree and confirmed shared understanding.

## Answer

Use **matched, held-out, manifest-audited Clean-Session Runs**. Evaluate teaching, orchestration, absence of hidden author context, and structural self-consistency as separate claims. No aggregate “system works” verdict may substitute for their individual receipts.

### Claim and task matrix

| Claim | Required task | Falsifier |
|---|---|---|
| Ariadne Teaching Skill teaches routing and transfer | one held-out faded parser decision and one changed causal retry/duplicate-effect task | oral help, undeclared input, wrong route/evidence, incomplete artifacts, or failed transfer |
| Methodology Authoring Teaching Skill teaches independent authoring | one held-out incident-handoff guide and one metamethodological guide-authoring transfer | missing triggered artifact, rationale, owner receipt, recovery, or acyclic transfer |
| Harness Authoring Teaching Skill teaches minimal harness design | one held-out issue-triage continuation and one staged-self-application transfer | skipped baseline, copied owner state, unsafe recovery, retained untriggered mechanism, or runtime recursion |
| Orchestration Harness executes the contract | one end-to-end continuation task through the success path and every independent failure injection | loss of unique disposition, synthesized authority, duplicate effect, invalid transition, hidden memory, or unrecoverable valid state |
| Clean-session isolation excludes author context | every evaluation run | any unlisted conversation, memory, file, network result, sibling artifact, oracle, or intervention enters the run |

Run every task twice in isolated sessions for each advertised host, model, and adapter combination. This supports only the tested combination and fixture; it is not a population-level pedagogy claim. The learner receives the complete task at invocation. The evaluator withholds only the versioned oracle and arm assignment.

### Clean-session boundary

Each run starts in a new host session or process with an isolated workspace view containing only the allowlisted pinned inputs and any intentionally seeded owner pointers. Its evaluation manifest records:

- evaluation, task, oracle, Method Contract, guide, Teaching Skill, adapter, workspace, host, and model versions and digests;
- allowed source pointers, tool and network capabilities, run configuration, budget, and output locations;
- the initial workspace inventory plus session, transcript, tool-access, trace, artifact, and terminal-disposition pointers.

Author conversation, model memory, oral guidance, undeclared files or network results, sibling-run artifacts, oracle content, and copied normative or owner state are forbidden. A missing isolation receipt is `INCONCLUSIVE`; an observed leak is `FALSIFIED`.

### Artifact assertions

Reuse the Method Contract, Teaching Skill checks, Ariadne gates, and adapter contracts. Machine checks must assert:

- manifest, pins, initial inventory, source resolution, and tool trace agree;
- every required artifact is schema-valid and every triggered obligation and completion predicate is satisfied;
- method route, claim class, evidence rung, rationale links, output, recovery, self-explanation, fading, and transfer match the held-out oracle;
- owner state remains behind valid pointers with no shadow normative, workflow, epistemic, permission, or human state;
- harness cursors, events, lifecycle transitions, authority, receipts, replay budget, cancellation, ambiguity handling, and repository outcomes satisfy tickets 09 and 10;
- no circular proof, undeclared input, sibling-run dependency, or author intervention occurs.

### Evidentiary Ladder contract

| Rung | Claim supported |
|---|---|
| 2 | schema, compilation, type, and lint correctness |
| 3 | deterministic artifact, route, example, and lifecycle-model logic |
| 5 | validator-suite quality, with `MSI >= 85%` and every critical isolation, ownership, evidence, lifecycle, circularity, and deletion mutant killed |
| 6 | bounded clean-session teaching and transfer, real owner-adapter conformance, and comparative neutral-kernel necessity |
| 8 | crash, concurrency, replay, cancellation, ambiguous-effect, and recovery safety |

Rungs 7, 9, and 10 are not required unless later claims add performance, migration, canary, or sustained-production behavior. Structural fixed-point success remains necessary for self-application but never satisfies external teaching or runtime evidence.

### Failure injections

Exercise each safety boundary independently rather than building a combinatorial fault matrix:

1. missing, malformed, corrupt, or owner-mismatched artifact or receipt;
2. source, workspace, Method Contract, capability, adapter, or state pin drift;
3. process reset at cold start, mid-run, approval wait, and after an owner effect but before receipt persistence;
4. missing, denied, expired, broadened, or input-mismatched approval;
5. stale concurrent dispatch plus duplicate, conflicting, gapped, or regressed events;
6. cancellation racing with committed success or lacking owner acknowledgment;
7. ambiguous effect plus false `committed` or `no_effect` receipt;
8. replay without an owner declaration, stable idempotency key, remaining budget, deadline, or resolved ambiguity.

Use disposable workspaces and simulated effects. Never induce or replay a real ambiguous external effect.

### Review and aggregation

Deterministic gates run first. An independent evaluation operator audits provisioning, the manifest, initial inventory, access trace, and absence of intervention. An independent domain reviewer scores only semantic correctness, transfer, recovery, and owner boundaries against a preregistered rubric while blinded to the arm. Add a second reviewer only for a critical criterion with no deterministic oracle; disagreement is `INCONCLUSIVE`, never an averaged pass.

Report `SUPPORTED`, `FALSIFIED`, or `INCONCLUSIVE` separately by skill, task, environment combination, adapter, injection, and baseline arm. Every critical criterion must pass every required run. No weighted score or unrelated success compensates for a critical failure.

### Matched baselines and deletion rule

- **Teaching:** compare the full Teaching Skill with the same pinned task and normative sources but without that Teaching Skill.
- **Orchestration:** compare the neutral kernel with the thin skill-loader-plus-owner-artifacts path.
- **Controls:** task, sources, host, model, tools, budget, pins, and evaluator are identical across arms.

Retain a Teaching Skill only when every full-arm critical gate passes and its source-only arm fails at least one intended teaching or transfer criterion. Retain the neutral kernel only when it passes a hard continuation invariant that every thinner eligible baseline fails. If both arms pass, delete or inline the added layer. Variable results remain `INCONCLUSIVE` and justify more matched runs, not speculative retention.

### Ariadne records and reopening

- [`DEC-clean-session-verification-contract`](../../../.ariadne/GRAPH.jsonl) records the accepted evaluation contract.
- [`VAL-SELECT-clean-session-verification`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate filter and adversarial critique.
- [`EVDREQ-teaching-skills-clean-session-transfer-r6`](../../../.ariadne/GRAPH.jsonl), [`EVDREQ-clean-session-validator-quality-r5`](../../../.ariadne/GRAPH.jsonl), and [`EVDREQ-owner-adapter-clean-session-conformance-r6`](../../../.ariadne/GRAPH.jsonl) record the new empirical obligations.
- Existing [`EVDREQ-clean-session-runtime-necessity`](../../../.ariadne/GRAPH.jsonl) and [`EVDREQ-runtime-safety-recovery-r8`](../../../.ariadne/GRAPH.jsonl) remain the kernel-deletion and fault-injection obligations.
- [`OBS-clean-session-verification-post-decision-gate`](../../../.ariadne/GRAPH.jsonl) records passing structural and semantic gates without fabricating the open empirical results.

Reopen if a supported host cannot expose an auditable isolation boundary, held-out transfer reveals a missing method obligation, mutation testing leaves a critical validator gap, production adapters diverge from their contract, Rung 8 faults violate safety, or repeated `INCONCLUSIVE` outcomes require a statistical or broader-environment evaluation design.
