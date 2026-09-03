# Neutral Orchestration Boundary Validation

## Decision

**Verdict for `CLM-neutral-orchestration-preserves-ownership`: `SUPPORTED` at Ariadne Evidence Rung 1 (Static Plausibility), conditionally.** A neutral orchestration subsystem is a coherent ownership boundary if it coordinates only through owner-controlled adapters, owns only orchestration-attempt state, and stores references rather than copies of Matt workflow artifacts, Ariadne epistemic state, or Method Contract rules.

**Verdict for `ASM-dedicated-runtime-necessity`: `INCONCLUSIVE` and outside this evidence result.** The inspection found no repository fact showing that a new runtime is required. A thin package on the existing host skill loader and Ariadne CLI/controller, and a host-specific plugin using the same ownership rules, remain eligible until a clean-session contract pilot identifies a missing behavior.

The conclusion is deliberately narrow: **the boundary is coherent; a new runtime is not yet justified.** Rung 1 proves only static plausibility. An implemented adapter boundary would be a `Boundary contract` claim and requires Rung 6 integration/contract evidence under Ariadne's ladder ([evidence.md:22](/mnt/c/Users/bulky/Projects/ariadne/.agents/skills/ariadne/rules/evidence.md:22)).

## Question and method

This report answers the claimed ticket question in [02-validate-neutral-orchestration-boundary.md:10](/mnt/c/Users/bulky/Projects/ariadne/.scratch/methodological-harness-system/issues/02-validate-neutral-orchestration-boundary.md:10) using:

1. Ariadne Dependencies: ownership, DSM, six coupling classes, transitive consumers, change radius, and information-hiding contracts.
2. Ariadne Value: a non-compensatory hard-requirement filter before preferences.
3. Ariadne Validate: explicit claim, falsifiers, rung, environment, receipt, and verdict.
4. Adversarial critique against duplicated state, hidden semantics, failure recovery, cycles, and speculative runtime value.

The requested Rung 1 permits design/code inspection when assumptions and falsification conditions are explicit ([evidence.md:5](/mnt/c/Users/bulky/Projects/ariadne/.agents/skills/ariadne/rules/evidence.md:5), [evidence.md:9](/mnt/c/Users/bulky/Projects/ariadne/.agents/skills/ariadne/rules/evidence.md:9)). No runtime was implemented or exercised.

## Primary repository facts

1. Ariadne explicitly owns an epistemic overlay and explicitly does **not** own delivery orchestration ([00-core.md:5](/mnt/c/Users/bulky/Projects/ariadne/.agents/skills/ariadne/rules/00-core.md:5)). Its graph must remain append-only and deductive edges acyclic ([00-core.md:58](/mnt/c/Users/bulky/Projects/ariadne/.agents/skills/ariadne/rules/00-core.md:58)).
2. Wayfinder owns its map, ticket identity, claim state, blocking, frontier, and resolution in the issue tracker ([wayfinder/SKILL.md:19](/mnt/c/Users/bulky/.gemini/config/plugins/mattpocock-skills/skills/engineering/wayfinder/SKILL.md:19), [wayfinder/SKILL.md:55](/mnt/c/Users/bulky/.gemini/config/plugins/mattpocock-skills/skills/engineering/wayfinder/SKILL.md:55), [wayfinder/SKILL.md:118](/mnt/c/Users/bulky/.gemini/config/plugins/mattpocock-skills/skills/engineering/wayfinder/SKILL.md:118)). A runtime that independently assigns ticket meaning or status would duplicate Matt-owned workflow semantics.
3. The local tracker makes its Markdown files authoritative for map, ticket, blocking, frontier, claim, and resolution state ([issue-tracker.md:18](/mnt/c/Users/bulky/Projects/ariadne/docs/agents/issue-tracker.md:18)).
4. The current Ariadne `AriadneHarnessController` owns capability detection, graph storage, GSD projection, Matt artifact normalization/ingestion, and graph reads; it does not invoke, schedule, cancel, or resume Matt skills ([controller.ts:43](/mnt/c/Users/bulky/Projects/ariadne/src/harness/controller.ts:43), [controller.ts:64](/mnt/c/Users/bulky/Projects/ariadne/src/harness/controller.ts:64), [controller.ts:121](/mnt/c/Users/bulky/Projects/ariadne/src/harness/controller.ts:121)). This is a reusable Ariadne adapter surface, not evidence that a second runtime is necessary.
5. Ariadne's Matt adapter accepts only a fixed skill set and converts skill output into validated `EVD`/`EVDREQ` nodes ([ingest.ts:7](/mnt/c/Users/bulky/Projects/ariadne/src/adapters/matt/ingest.ts:7), [ingest.ts:207](/mnt/c/Users/bulky/Projects/ariadne/src/adapters/matt/ingest.ts:207)). Complete evidence requires verdict, method, rung, source/command, receipt, and environment ([ingest.ts:158](/mnt/c/Users/bulky/Projects/ariadne/src/adapters/matt/ingest.ts:158)). Tests show incomplete artifacts remain requests and fully receipted executions become evidence ([matt.test.ts:9](/mnt/c/Users/bulky/Projects/ariadne/tests/adapters/matt.test.ts:9), [matt.test.ts:37](/mnt/c/Users/bulky/Projects/ariadne/tests/adapters/matt.test.ts:37)).
6. Graph persistence validates every proposed event and the prospective whole graph under an Ariadne-owned lock before append ([storage.ts:247](/mnt/c/Users/bulky/Projects/ariadne/src/graph/storage.ts:247)). A neutral runtime therefore has no reason to write `GRAPH.jsonl` directly.
7. The methodological guide separates the structure of a method from the structure for teaching it ([designing_methodological_guides.md:1135](/mnt/c/Users/bulky/Projects/ariadne/docs/designing_methodological_guides.md:1135)), requires a complete worked example and progressive transfer ([designing_methodological_guides.md:169](/mnt/c/Users/bulky/Projects/ariadne/docs/designing_methodological_guides.md:169)), and defines the normative fixed point over `P/A/R/L`, not presentation ([designing_methodological_guides.md:1649](/mnt/c/Users/bulky/Projects/ariadne/docs/designing_methodological_guides.md:1649)). Self-consistency must not be used as external evidence ([designing_methodological_guides.md:1710](/mnt/c/Users/bulky/Projects/ariadne/docs/designing_methodological_guides.md:1710)).
8. The current domain glossary already assigns the Method Contract, Teaching Skill, Orchestration Harness, and staged self-application distinct meanings ([CONTEXT.md:29](/mnt/c/Users/bulky/Projects/ariadne/CONTEXT.md:29), [CONTEXT.md:33](/mnt/c/Users/bulky/Projects/ariadne/CONTEXT.md:33), [CONTEXT.md:37](/mnt/c/Users/bulky/Projects/ariadne/CONTEXT.md:37), [CONTEXT.md:41](/mnt/c/Users/bulky/Projects/ariadne/CONTEXT.md:41)).
9. Current graph inspection records the user-selected boundary as provisional and asks this report to test it ([GRAPH.jsonl:143](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl:143), [GRAPH.jsonl:145](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl:145), [GRAPH.jsonl:147](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl:147)).

## Authoritative ownership

| Critical datum or semantic contract | Sole authoritative owner | What the neutral runtime may retain | Forbidden duplicate |
| --- | --- | --- | --- |
| Matt skill rules, branching, and HITL/AFK behavior | Matt skill package | Skill reference, invocation ID, opaque artifact pointer | Parsed or reconstructed skill semantics |
| Ticket identity, frontier, claim, blocking, resolution | Configured issue tracker | Ticket pointer and owner-issued receipt | Parsed or mirrored ticket/workflow state |
| Ariadne nodes, edges, provenance, invalidation, gates, frontier, evidence promotion | Ariadne CLI/controller and `.ariadne`/`.planning/ariadne` storage | Graph receipt ID, node IDs, gate-receipt pointer | Mirrored graph, direct graph writes, locally inferred provenance |
| Normative `P/A/R/L`, rule IDs, artifact schemas, completion predicates, method version | Versioned Method Contract and its named owner | Contract ID/version/hash and referenced rule/artifact IDs | Copied normative rules in runtime code or config |
| Rationale, source traceability, explanatory book | `docs/designing_methodological_guides.md` owner | Rationale link | Runtime-owned rationale summaries treated as normative |
| Teaching sequence, worked examples, progressive disclosure | Each Teaching Skill package | Skill version/reference | Runtime reconstruction of instructional content |
| Host tool availability, permissions, process handle, user channel, model session | Host adapter/host | Opaque host invocation ID and declared capability snapshot | Host credentials or alternate user/HITL state |
| Orchestration attempt, correlation, idempotency, timeout, cancellation intent, adapter receipt pointers | Neutral orchestration subsystem | The authoritative orchestration ledger itself | Matt workflow status, Ariadne epistemic state, or contract content |
| Human decision or answer | Human, recorded through the owning Matt/tracker workflow | `needs_human` outcome and pointer after the owner records it | Synthesized human response |

The runtime ledger is a distinct datum, not a second task tracker. Its deletion may lose resume convenience for an in-flight orchestration attempt, but must not erase or change the canonical Matt ticket, Ariadne graph, Method Contract, or human decision.

## Design Structure Matrix

Rows consume columns. Codes: `S` static, `D` dynamic, `Da` data, `P` deployment, `E` event, `M` migration. `—` means no required coupling. Multiple codes in one cell are intentional.

| Consumer ↓ / Provider → | Method Contract (C) | Teaching/Matt skills + tracker (W) | Ariadne (A) | Host adapter (H) | Neutral runtime (O) |
| --- | --- | --- | --- | --- | --- |
| **C — Method Contract** | — | — | — | — | — |
| **W — Teaching/Matt skills + tracker** | `S,Da,P,M` | — | `D,E` only when the skill explicitly invokes Ariadne | `D,P,E` | —; direct invocation remains valid |
| **A — Ariadne** | — | `Da,E` through Ariadne-owned normalization | — | `P` runtime environment only | — |
| **H — Host adapter** | — | `S,D,P,E` skill loading/invocation | `S,D,P,E` CLI/API invocation | — | `S,D,E` command/receipt protocol |
| **O — Neutral runtime** | `S,Da,P,M` read-only versioned rules | `D,E` through owner adapter; opaque artifact refs | `D,Da,E` through Ariadne API; graph receipt refs | `D,P,E` capabilities, process, cancellation, HITL | `Da,P,E,M` own ledger/version |

No live deductive or state-ownership cycle is required:

```text
Method Contract ──read-only──┐
Matt/Tracker ──owner API─────┼──> Neutral Orchestration Ledger
Ariadne Graph ──owner API────┤            │
Host ──invoke/cancel/receipt─┘            └── references only
```

The staged `F(M)` self-application is a build/verification sequence, not a live runtime dependency. The graph's current structural gate also passes, so no existing deductive cycle was observed.

## Coupling analysis

### Static

- Runtime code depends only on four small interfaces: Method Contract reader, Matt/Teaching Skill invocation, Ariadne command/API, and host execution.
- Ariadne already exports controller, normalization, graph, and gate surfaces from its package ([index.ts:1](/mnt/c/Users/bulky/Projects/ariadne/src/index.ts:1)). The Ariadne adapter should reuse these exports or the CLI, never internal files.
- No stable programmatic Matt invoke/cancel interface is present in the inspected repository. Wayfinder specifies use of the host Skill tool ([wayfinder/SKILL.md:103](/mnt/c/Users/bulky/.gemini/config/plugins/mattpocock-skills/skills/engineering/wayfinder/SKILL.md:103)). Availability of an owner-controlled Matt invocation adapter is therefore an unresolved implementation precondition.

### Dynamic

- Runtime may start an invocation, request cancellation, enforce an orchestration timeout, pause for HITL, and collect an opaque receipt.
- Runtime must not decide whether a Wayfinder ticket is frontier/blocked/resolved, answer a grilling ticket for the human, or promote evidence. Those branches remain in Matt and Ariadne.
- Failure propagation stops at the adapter. On partial completion the runtime records its own attempt as incomplete and asks the owner API for an idempotent retry/resume; it does not compensate by editing external state.

### Data

- Runtime schema is limited to `session_id`, `attempt_id`, `step_ref`, `adapter_ref`, `contract_version`, `idempotency_key`, timestamps/deadline, orchestration outcome, and immutable receipt/artifact pointers.
- It may cache owner data for display only when the cache is explicitly non-authoritative and disposable.
- `GRAPH.jsonl`, tracker Markdown, skill instructions, and Method Contract content remain outside the runtime database.

### Deployment

- Physical co-location in this repository is compatible with conceptual neutrality if package/export boundaries prevent internal imports.
- The runtime owns only its package and ledger-schema versions. Each adapter declares compatible host, Matt skill bundle, Ariadne CLI/API, and Method Contract versions.
- Release and rollback must be runtime-first and additive: old direct skill/CLI invocation stays available; rolling back the runtime cannot require rolling back owner data.
- Exact process model, package location, and host distribution remain unknown and should not be selected by this validation.

### Event

- Minimum owner-neutral envelopes are `InvocationRequested`, `InvocationNeedsHuman`, `InvocationCompleted`, and `InvocationFailed/Cancelled`.
- Envelopes carry correlation/idempotency keys, outcome, and owner receipt pointers; they do not embed ticket bodies, graph snapshots, or normative rules.
- No event broker is required by the current facts. An in-process call or host command returning the same envelope satisfies the contract.

### Migration

- There is no pre-existing neutral runtime state to migrate.
- Adoption is opt-in: direct Matt and Ariadne use is the legacy-compatible path. The first runtime version adds a new ledger without backfill, dual write, or read switch of owner data.
- Later runtime-ledger schema migrations are owned and verified by the runtime. Method Contract version changes are owned by the contract lifecycle and referenced, not migrated, by the runtime.
- A design that requires importing tracker state or the Ariadne graph into the runtime fails the ownership invariant rather than becoming a migration task.

## Change radius

The semantic change radius is **architectural/high**, although this ticket makes no implementation change.

```text
R = {
  1 new conceptual runtime module,
  4 bounded interfaces (contract, Matt/skill, Ariadne, host),
  1 runtime-owned ledger schema,
  4 adapter compatibility/version declarations,
  4 minimal orchestration outcome envelopes,
  1 additive adoption/rollback path,
  3 direct consumers (methodology-authoring skill, harness-authoring skill, self-harness),
  3 transitive consumer classes (clean-session pilots, lifecycle checks, future methodology packages)
}
```

Volatile decisions are hidden as follows:

- host invocation mechanics → host adapter;
- Matt workflow and artifact semantics → Matt/skill adapter owned with the skill package;
- Ariadne schema/storage/gate changes → Ariadne adapter;
- method rule evolution → versioned Method Contract;
- retry, correlation, timeout, and orchestration resume → neutral runtime.

The runtime is acceptable only if this partition holds. Physical file count and technology stack are not part of the validated claim.

## Bounded adapter contracts

### 1. Method Contract reader

**Input:** `contract_ref`, supported contract schema versions.
**Output:** immutable `contract_id`, semantic version, content hash, rule/artifact IDs, declared entry/completion predicates.
**Owner:** Method Contract.
**Runtime prohibition:** no embedded fallback rules; unknown versions fail closed with `needs_upgrade`.

### 2. Matt/Teaching Skill invocation

**Input:** `skill_ref`, `task_ref`, immutable context/artifact references, interaction mode (`AFK`/`HITL`), `session_id`, `attempt_id`, timeout/cancellation token.
**Output:** owner-defined outcome (`completed`, `needs_human`, `cancelled`, `failed`), opaque tracker/artifact pointers, host invocation ID, diagnostics pointer.
**Owner:** skill package and configured tracker; host owns process/user-channel mechanics.
**Runtime prohibition:** no ticket parsing, frontier computation, human-answer synthesis, or result reclassification.

This interface is specified but not proven to exist. If the host exposes only unconstrained free-form skill text and the runtime must understand Wayfinder/domain-modeling semantics to proceed, the neutral boundary is falsified for that host.

### 3. Ariadne adapter

**Input:** owner-supported CLI/API operation or Matt artifact, correlation metadata, expected graph revision.
**Output:** validated node/edge IDs, graph/gate receipt, revision, or Ariadne-owned diagnostic.
**Owner:** Ariadne.
**Runtime prohibition:** no direct `.ariadne` writes, graph mirroring, provenance promotion, transitive invalidation, or local gate implementation.

The existing controller and Matt normalizer demonstrate a plausible owner API, while transactional validation demonstrates that Ariadne can remain the sole writer.

### 4. Host adapter

**Input:** invocation envelope, declared capabilities, permissions, timeout/cancellation token.
**Output:** process/invocation handle, lifecycle outcome, capability/version snapshot, artifact pointers.
**Owner:** host integration.
**Runtime prohibition:** no credential persistence and no assumption that HITL can be converted to AFK.

### 5. Runtime session receipt

**Input:** owner receipts from the four interfaces.
**Output:** immutable session/attempt timeline with correlation IDs, referenced versions, outcomes, pointer hashes, unresolved owner actions, and final orchestration disposition.
**Owner:** neutral runtime.
**Non-authority clause:** the receipt describes what the runtime observed; it does not supersede the tracker, graph, contract, or human record.

## Non-compensatory hard-requirement filter

Hard requirements were copied from the current Frame, Dependency, and decisions: Ariadne remains an overlay; Matt retains workflow semantics; Method Contract remains the only normative source; every critical datum has one owner; runtime dependencies are acyclic; direct Matt/Ariadne use remains possible; self-consistency is not empirical proof; and the runtime's necessity remains falsifiable.

| Candidate | Single owners | Ariadne stays overlay | Matt keeps workflow | One normative source | Acyclic/direct use | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Neutral runtime with bounded owner adapters | PASS | PASS | PASS | PASS | PASS, conditionally | **Eligible at Rung 1** |
| Runtime embedded in Ariadne and owning session/workflow semantics | FAIL | FAIL | not guaranteed | PASS | direct use at risk | **Rejected** before preferences |
| Runtime directly reading/writing tracker, graph, or copied contract rules | FAIL | FAIL | FAIL | FAIL | recovery cycle likely | **Rejected** before preferences |
| Host-specific plugin using the same owner adapters | PASS | PASS | PASS | PASS | PASS for one host | **Eligible**; portability is a preference/unknown |
| Thin skill package on existing host loader + Ariadne CLI/controller | PASS | PASS | PASS | PASS | PASS | **Eligible**; orchestration adequacy unknown |

No preference score can select a new neutral runtime yet because two lower-cost candidates survive every hard requirement. The next decision must compare only behaviors that the thin package and host plugin demonstrably cannot supply.

## Adversarial critique

| Attack | Consequence if true | Boundary response | Result |
| --- | --- | --- | --- |
| The runtime ledger becomes a second issue tracker | Two owners for progress/status | Store attempt state and pointers only; Matt/tracker owns semantic workflow state | Defended by contract; falsify if resume requires mirrored ticket state |
| Free-form Matt outputs force semantic parsing | Runtime owns Matt branches accidentally | Require an owner-controlled invoke/cancel/receipt adapter | **Open risk**; current repository proves ingestion, not invocation |
| `AriadneHarnessController` already is the runtime | New subsystem duplicates capability/provider state | Reuse it behind the Ariadne adapter; do not reimplement detection/storage/gates | Runtime necessity remains unknown |
| Partial success requires a distributed transaction across tracker and graph | Atomicity forces shared state or compensation semantics | Use idempotent owner receipts and explicit incomplete session; no cross-owner atomicity requirement exists | Defended under current requirements; new atomicity requirement would falsify |
| Physical co-location erodes conceptual neutrality | Direct imports bypass owner APIs | Public export/CLI-only adapter rule plus contract tests | Defended statically, needs Rung 6 proof |
| Staged self-application creates runtime recursion | Bootstrap/failure cycle | Run versioned stages sequentially; `F(M)` is build-time verification, not live mutual invocation | Defended by selected topology and guide |
| Runtime silently answers HITL work | Human ownership is lost | `needs_human` is a terminal/pause outcome until the owning workflow records a response | Defended by adapter contract |
| Version skew changes semantics | Receipt no longer reproducible | Pin/hash contract and adapter compatibility; fail closed on unsupported versions | Defended statically, needs lifecycle tests |
| The runtime is a shallow pass-through | Added lifecycle and failure surface with no useful behavior | Apply deletion test in clean-session pilot; if required behavior remains with loader+CLI, delete the runtime candidate | **Open; directly tests necessity** |

## Falsification conditions

The `SUPPORTED` boundary verdict must be changed to `FALSIFIED` if any of the following is required by the minimum orchestration contract or observed in a pilot:

1. The runtime must parse or mutate Wayfinder/Matt ticket semantics rather than invoke an owner-controlled interface.
2. The runtime must write, mirror, promote, invalidate, or reconcile Ariadne epistemic nodes outside Ariadne-owned APIs.
3. The runtime must embed normative method rules or completion semantics instead of reading an identified Method Contract version.
4. Recovery requires two authoritative owners for any session, workflow, graph, contract, or human datum.
5. Correctness requires atomic commit across Matt/tracker and Ariadne, with the runtime becoming transaction coordinator and semantic compensator.
6. Direct Matt skill or Ariadne use cannot remain valid after runtime adoption.
7. A live dependency cycle is introduced among runtime, Matt, Ariadne, Method Contract, or the self-harness.

The following does **not** falsify boundary coherence, but falsifies or weakens runtime necessity:

- the existing host skill loader plus Ariadne CLI/controller completes the clean-session scenario with the required receipts and lifecycle behavior;
- a host-specific plugin supplies the only missing coordination without a host-neutral process;
- the neutral module is a pass-through whose deletion does not redistribute meaningful behavior to callers.

## Validation receipt

### Claim

- Target: `CLM-neutral-orchestration-preserves-ownership`
- Class: `Architectural boundary` as recorded by the request
- Required invariant: one owner for every critical state/semantic contract; no deductive runtime cycle
- Requested/actual rung: `1 / 1`
- Method: repository inspection + Dependencies DSM + Value constraint filter + adversarial critique + in-memory graph/schema validation
- Result: no repository fact forces duplicate ownership or a deductive cycle under the bounded contracts above
- Verdict: `SUPPORTED`
- Provenance limit: the candidate claim remains `PROPOSED`; static support does not make an unimplemented contract `FACT`

### Reproducible environment and sources

- Inspected main worktree HEAD: `97027f8b1d94d3aceaa735265cb3ebd8c3d05b7e`
- Working tree: dirty by design; the evidence includes uncommitted `.ariadne/*`, `CONTEXT.md`, `.scratch/methodological-harness-system/*`, and `docs/designing_methodological_guides.md`
- Environment: `Linux 5.15.167.4-microsoft-standard-WSL2 x86_64`
- Inspection time: `2026-08-22T06:04:11Z`
- Graph SHA-256: `8bee52c78d485cad0823643cfd2828b5258867a7228fbe5dd1140fc24cb36959`
- Context SHA-256: `5991327ce83411f2e618f96ec7816297534f04c1a64eb9a6d0f9d7805b2c4bf7`
- Methodological guide SHA-256: `fbf338536f145cb7952d0832bd405d2870c8a53e64fb28cad6fac38e35d6bad1`

Commands run from the main worktree:

```bash
rtk node /mnt/c/Users/bulky/Projects/ariadne/dist/cli/index.js gate structural
rtk node /mnt/c/Users/bulky/Projects/ariadne/dist/cli/index.js gate semantic
rtk node /mnt/c/Users/bulky/Projects/ariadne/dist/cli/index.js gate epistemic
```

Receipt:

- Structural gate: `PASS`, no diagnostics.
- Semantic gate: `PASS`, no diagnostics.
- Epistemic gate before this receipt: expected `MISSING_EVIDENCE_RESULT` for this request; also reports that the provisional runtime decisions depend on assumed runtime necessity and lack adversarial critiques.
- In-memory application of the proposed `EVD`, `VAL`, edge replacements, and support edges: node schema `PASS`, edge schema `PASS`, structural `PASS`, semantic `PASS`, and no remaining diagnostic for `EVDREQ-neutral-orchestration-boundary`.
- The in-memory run intentionally leaves `DEC-orchestration-runtime-in-scope -> ASM-dedicated-runtime-necessity`; the gate continues to report that unresolved dependency. This preserves the distinction between coherent boundary and necessary runtime.

## Proposed graph mutations

The root agent can append the following after replacing `<REPORT_COMMIT>` and `<REPORT_SHA256>`. These events resolve only the boundary evidence request.

### EVD receipt

```json
{"kind":"node","node":{"id":"EVD-neutral-orchestration-boundary-r1","type":"EVD","provenance_type":"MEASURED","statement":"Repository inspection supports static ownership coherence of a neutral orchestration subsystem under bounded owner-controlled adapters; it does not establish that a new runtime is necessary.","title":"Neutral orchestration ownership is statically coherent","status":"SUPPORTED","verdict":"SUPPORTED","method":"Repository inspection plus Ariadne Dependencies DSM, non-compensatory Value filter, adversarial critique, and static validation","rung":1,"receipt":{"report":"docs/research/neutral-orchestration-boundary-validation.md","report_commit":"<REPORT_COMMIT>","report_sha256":"<REPORT_SHA256>","main_head":"97027f8b1d94d3aceaa735265cb3ebd8c3d05b7e","graph_sha256":"8bee52c78d485cad0823643cfd2828b5258867a7228fbe5dd1140fc24cb36959","structural_gate":"PASS","semantic_gate":"PASS"},"environment":"WSL2 Linux x86_64; repository working tree inspected 2026-08-22T06:04:11Z","evidence_request_id":"EVDREQ-neutral-orchestration-boundary","assumptions":["The minimum orchestration contract does not require cross-owner atomicity","Owner-controlled Matt and host adapter interfaces can be supplied without moving skill semantics into the runtime"],"falsification_conditions":["The runtime must interpret or mutate Matt workflow semantics","The runtime must mirror or author Ariadne state outside Ariadne APIs","The runtime must duplicate Method Contract rules","Recovery creates two authoritative owners for the same datum"]}}
```

### VAL receipt

```json
{"kind":"node","node":{"id":"VAL-neutral-orchestration-boundary-r1","type":"VAL","provenance_type":"PROPOSED","statement":"At Rung 1 the neutral ownership boundary is conditionally eligible: no required duplicated semantic or state owner and no deductive cycle were found; runtime necessity and implemented adapter compatibility remain unresolved.","title":"Static neutral orchestration boundary validation","status":"SUPPORTED","verdict":"SUPPORTED","claim":"CLM-neutral-orchestration-preserves-ownership","candidate":"CAN-dedicated-orchestration-runtime","evidence_rung":1,"method":"Dependencies DSM plus non-compensatory hard-requirement filter and adversarial critique","hard_requirements":[{"id":"ariadne-overlay","hard":true,"status":"PASS"},{"id":"matt-workflow-ownership","hard":true,"status":"PASS"},{"id":"single-normative-source","hard":true,"status":"PASS"},{"id":"one-owner-per-critical-datum","hard":true,"status":"PASS"},{"id":"acyclic-runtime","hard":true,"status":"PASS"},{"id":"direct-use-remains-possible","hard":true,"status":"PASS"}],"selection":"Conditional support for the neutral boundary if a runtime is independently justified","unresolved_unknowns":["ASM-dedicated-runtime-necessity","programmatic Matt invoke/cancel/receipt availability","host-neutral process and packaging model"],"adversarial_critique":["A free-form Matt skill surface may force semantic parsing unless an owner-controlled adapter exists.","A runtime session ledger becomes a second tracker if it stores workflow status rather than attempt state and pointers.","Cross-owner atomicity would force shared ownership; no such requirement is currently present.","The existing host loader and Ariadne controller may make a new runtime a removable pass-through."]}}
```

### Evidence and validation edges

```jsonl
{"kind":"edge","edge":{"source":"EVD-neutral-orchestration-boundary-r1","target":"EVDREQ-neutral-orchestration-boundary","type":"answers"}}
{"kind":"edge","edge":{"source":"EVD-neutral-orchestration-boundary-r1","target":"CLM-neutral-orchestration-preserves-ownership","type":"supports"}}
{"kind":"edge","edge":{"source":"EVD-neutral-orchestration-boundary-r1","target":"DEC-neutral-orchestration-subsystem","type":"supports"}}
{"kind":"edge","edge":{"source":"VAL-neutral-orchestration-boundary-r1","target":"CLM-neutral-orchestration-preserves-ownership","type":"supports"}}
{"kind":"edge","edge":{"source":"VAL-neutral-orchestration-boundary-r1","target":"CAN-dedicated-orchestration-runtime","type":"tests"}}
{"kind":"edge","edge":{"source":"VAL-neutral-orchestration-boundary-r1","target":"DEP-neutral-orchestration-boundary","type":"references"}}
```

### Correct two conflated dependencies

The current graph makes the conditional ownership claim and conditional boundary decision deductively depend on runtime necessity ([GRAPH.jsonl:149](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl:149), [GRAPH.jsonl:153](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl:153)). That is logically stronger than their statements: the question “if orchestration exists, can it be neutral?” does not depend on “must orchestration be a new runtime?”. Replace those two `depends_on` edges with non-deductive references:

```jsonl
{"kind":"edge","edge":{"source":"CLM-neutral-orchestration-preserves-ownership","target":"ASM-dedicated-runtime-necessity","type":"depends_on"},"tombstone":true}
{"kind":"edge","edge":{"source":"DEC-neutral-orchestration-subsystem","target":"ASM-dedicated-runtime-necessity","type":"depends_on"},"tombstone":true}
{"kind":"edge","edge":{"source":"CLM-neutral-orchestration-preserves-ownership","target":"ASM-dedicated-runtime-necessity","type":"references"}}
{"kind":"edge","edge":{"source":"DEC-neutral-orchestration-subsystem","target":"ASM-dedicated-runtime-necessity","type":"references"}}
```

Do **not** remove `DEC-orchestration-runtime-in-scope -> ASM-dedicated-runtime-necessity`. That dependency correctly keeps the new-runtime decision provisional.

### Decision enrichment still needed

Before the neutral boundary decision is treated as locked, append a revision of `DEC-neutral-orchestration-subsystem` that cites this evidence/candidate, carries the adversarial critique above, and explicitly leaves runtime necessity and Rung 6 adapter compatibility unresolved. The current epistemic gate reports `MISSING_ADVERSARIAL_CRITIQUE`; this report should not silently promote the decision past that gate.

## Next evidence

1. In “Decide the minimum Orchestration Harness contract,” identify one required observable behavior absent from the existing host loader + Ariadne controller/CLI. If none exists, falsify `ASM-dedicated-runtime-necessity` and select the thin-package fallback.
2. Prototype the Matt/host invoke-cancel-HITL-receipt seam. If it requires parsing Matt workflow semantics, falsify the neutral boundary for that host.
3. If a runtime survives, run a clean-session Rung 6 contract test across real Matt and Ariadne adapters, including cancellation, partial completion, idempotent resume, version mismatch, and direct-use compatibility.
