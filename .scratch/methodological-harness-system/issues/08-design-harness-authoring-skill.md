# Design the Harness Authoring Teaching Skill

Type: prototype
Status: resolved
Blocked by: 01, 03, 04, 05
Parent: [Methodological Harness System](../map.md)

## Question

What method, trigger set, complete worked example, artifact contract, validation path, and lifecycle guidance teach a fresh agent to design a modern agent harness—and how does the skill demonstrate its own construction through staged self-application?

## Comments

- [Throwaway harness-authoring teaching-flow prototype](../prototypes/08-harness-authoring-teaching-flow.throwaway.html) accepts both a justified minimal-kernel path and a valid trimmed-baseline path while rejecting copied owner state, ambiguous replay, pin drift, and live runtime recursion.

## Answer

Use a **failure-driven, source-pinned vertical slice**. The learner starts with one repository-observable lifecycle failure, writes the outcome fixtures before selecting a mechanism, tests the thin baseline, and adds only responsibilities whose triggers actually fire. A passing baseline is a valid completion and deletes the proposed kernel.

The teaching skill owns lesson order, task and failure fixtures, source-routing prompts, recovery practice, fading, transfer, and completion guidance only. The pinned Method Contract owns normative method rules; the harness research owns current external practice and provenance; the tracker and Ariadne own work and epistemic state; the host owns its model/tool loop, sandbox, approvals, sessions, and native traces; the Orchestration Harness may own only attempt pointers and generic gates.

### Minimum entry path

1. Present a meaningful lifecycle task before naming harness components.
2. Load `bootstrap.lock`; resolve and validate the exact `G_n`, `M_n`, `MA_n`, harness-research, workspace, and host-capability versions and byte digests.
3. Write repository-observable success, failure, and stop fixtures before choosing an architecture.
4. Assign every datum and enforcement responsibility to the method, tracker, Ariadne, host, or harness owner.
5. Run the thin skill-loader-plus-owner-artifacts baseline. Retain a new boundary only for a failed hard invariant.
6. Filter the thin baseline, a host-specific plugin, and a neutral kernel non-compensatorily: one failed hard requirement makes a candidate ineligible.
7. Add only mechanisms whose observable trigger fired; keep owner payloads behind resolvable pointers.
8. Run lifecycle, artifact, approval, replay, pin, adapter, recovery, and trace fixtures.
9. Practice one targeted recovery, answer self-explanation prompts, complete one faded case, and route one changed staged-self-application case.

Stop on a pin or capability mismatch, ambiguous ownership, copied owner state, invalid artifact or lifecycle transition, missing human/approval receipt, ambiguous side effect without an inspection path, candidate choice without the baseline test, live invocation of an active builder, or self-consistency offered as empirical proof.

### Trigger set

| Observable condition | Smallest mechanism added |
|---|---|
| Ordered context must survive a fresh process | Content-addressed context manifest of resolvable pointers |
| An attempt must pause, resume, cancel, or correlate retries | Repository-visible `run_id`, opaque step, lifecycle status, attempt, event cursor, and owner references |
| Advancement depends on machine-checkable output | Closed artifact envelope plus owner-receipt gate |
| Invocation, resume, approvals, sandbox, or traces differ by host | Capability-negotiated adapter that stores references to native objects |
| Human input or permission is pending | `waiting` state plus a pending-action pointer; the host still enforces approval |
| An effect may replay | Idempotency key, deadline, owner replay declaration, and inspection stop for ambiguity |
| Diagnosis or cross-host comparison needs correlation | Normalized lifecycle events and trace IDs; sensitive payload capture stays opt-in |
| Method, skill, adapter, workspace, or state versions may drift | Version/digest pins and fail-closed load/resume |
| Concurrent writers or remote coordination are measured requirements | The smallest storage/coordination mechanism that passes their contract |

The default remains atomic repository files and one writer. Do not add a database, queue, scheduler, migration framework, or service until its trigger is observed.

### Complete worked example

**Task:** design the smallest host-neutral harness that executes the dependency-change review method across fresh sessions, preserves a security approval wait, and does not duplicate a review publication after process loss.

#### Outcome contract

- A new process identifies exactly one valid next action from repository-visible state.
- Human, approval, invalid-artifact, pin-mismatch, and ambiguous-effect boundaries stop safely.
- No non-replay-safe effect is automatically duplicated.
- Method, tracker, Ariadne, and host semantics remain behind owner pointers.
- Every normalized event carries run, attempt, step, timestamp, and host-trace correlation.

#### Ownership

| Owner | Retained responsibility |
|---|---|
| Method Contract | Review rules, obligations, stops, and completion predicates |
| Tracker / Matt skills | Pull-request work state and conversation |
| Ariadne | Claims, evidence, uncertainty, decisions, and invalidation |
| Host | Model/tool loop, sandbox, permissions, native session, and trace objects |
| Orchestration Harness | Attempt cursor, pins, ordered pointers, generic gates, pending-action references, and normalized lifecycle events |

#### Candidate verdict

- **Thin baseline:** passes cold loading but fails mid-run reset and ambiguous-effect resolution without hidden human memory.
- **Host-specific plugin:** fails the stated host-neutral requirement, but remains an eligible single-host fallback or adapter.
- **Minimal neutral kernel:** passes the static hard-requirement filter and is retained provisionally, subject to ticket 11's deletion test.

#### Minimum records

The top-level lifecycle is only:

```text
created -> running -> waiting -> running -> succeeded | failed | canceled
```

`timeout`, `stall`, and `error` are attempt reasons, not additional top-level states.

The run record contains only:

```text
run_id, opaque step_ref, status, attempt,
Method Contract / skill / adapter / workspace / input pins,
idempotency key and deadline, event cursor,
owner receipt / artifact / pending-action pointers
```

The context manifest is an ordered list of content-addressed pointers with media type, role, version, digest, and owner. It does not make an opaque assembled prompt canonical.

Each artifact envelope contains schema version, artifact ID and kind, producing run/step/attempt, pinned input pointers, output pointer and digest, owner-receipt pointers, status, and completion-predicate result. The adapter surface remains:

```text
capabilities() -> versions, resume, approvals, traces, sandbox
start(context_manifest, workspace, policy) -> external_run_id
resume(external_run_id, decision_or_input) -> external_run_id
cancel(external_run_id) -> result
events(external_run_id, cursor) -> normalized events
```

#### Walkthrough

1. Cold start validates all pins and pointers, creates an attempt, and enters `running`.
2. Security evidence requires host-enforced approval; the harness records only the pending-action pointer and enters `waiting`.
3. A fresh process resolves the same pending action and resumes without synthesizing approval.
4. Review publication occurs, but the process ends before its receipt is stored. The attempt remains `waiting` with an ambiguous-effect pointer.
5. The owner inspects the external system and attaches the existing publication receipt. The harness resumes without replay.
6. Artifact, pin, owner-receipt, and completion gates pass; the attempt enters `succeeded`.

The evaluation fixtures are cold start, mid-run reset, approval reset, crash after side effect, corrupt artifact, method upgrade/pin drift, and fake-versus-production adapter conformance.

### Package and artifact contract

```text
SKILL.md
references/harness-research.md
example/README.md
example/input/dependency-review-run.json
example/solution/harness-project.json
example/check.mjs
```

`harness-project.json` is one non-normative worked bundle with separately addressable records for source pins, outcome requirements, ownership, trigger decisions, candidate filtering, run/context/artifact/adapter contracts, recovery, lifecycle events, evaluation fixtures, lifecycle decisions, and staged-self-application pointers.

The package contains no runtime scaffold, copied Method Contract, copied tracker/Ariadne/host state, framework tutorial, database, queue, scheduler, migration framework, plugin marketplace, or new dependency.

### Recovery contract

| Failure | Required response |
|---|---|
| Source, workspace, or capability pin mismatch | Stop; load the exact owner-approved pins and restart or open a compatible attempt. |
| Invalid artifact or owner receipt | Preserve the failure, repair only the named owner artifact, and rerun the affected gate. |
| Human or approval pending | Remain `waiting` with a resolvable pointer; never synthesize or bypass the decision. |
| Effect completion is ambiguous | Stop retries, preserve idempotency and correlation references, obtain an owner inspection receipt, then resume or compensate through the owner. |
| Unsupported state or adapter capability | Fail closed and hand the incompatibility to its owner. |
| Normative delta or assessor disagreement | Stop the immutable round; an accepted change starts `b_(n+1)` and rebuilds affected consumers. |

### Self-explanation, fading, and transfer

Require the learner to explain which observed failure justified every retained mechanism; why the harness stores owner pointers rather than payloads; why a passing baseline eliminates the kernel; why ambiguous effects stop; why raw prompt/tool payload capture is opt-in; and why `HA_n` is absent from the `OH_n` runtime graph.

For the **faded case**, provide an issue-triage continuation task, pins, outcome fixtures, and research pointers. Withhold the owner map, candidate verdict, trigger decisions, recovery policy, lifecycle decision, and completion verdict.

For **transfer**, ask the learner to route the methodology's self-application. The correct answer makes `HA_n` a build-time input that specifies `OH_n`; `OH_n` then coordinates two isolated applications of `M_n` under one immutable lock. Neither the active teaching skill nor the active harness invokes or rewrites its builder.

### Staged self-construction

```text
G_n + M_n -> MA_n
G_n + M_n + MA_n + pinned harness research -> HA_n
M_n + HA_n + owner adapter contracts -> OH_n
OH_n + pinned runtime graph -> S_n^A and S_n^B
```

`MA_n` authors `HA_n`; `HA_n` demonstrates its method by producing the complete `OH_n` design example and passing its structural check; `OH_n` coordinates the two isolated Method Contract applications. Any normative delta stops and can enter only a new immutable round. Structural self-consistency never satisfies external teaching or runtime evidence.

### Runnable completion contract

```sh
node example/check.mjs
```

Completion requires matching source/workspace/host pins; one owner per datum; one observed trigger for every retained mechanism; non-compensatory baseline/plugin/kernel results; valid pointer-only run, context, artifact, receipt, pending-action, adapter, and event records; fail-closed approval/replay/pin behavior; preserved recovery receipts; matching repository outcomes; a valid no-kernel result when the baseline passes; passing self-explanation, faded, and transfer rubrics; and no shadow state or runtime recursion.

### Lifecycle and reopening

- The teaching-skill owner maintains lesson order and fixtures; each source owner approves its normative content or adapter contract.
- Every active package and example records source versions/digests, workspace revision, adapter version, predecessor, and status.
- Review on source/provider changes, Method Contract or boundary changes, capability changes, a new failure class, repeated learner error, failed transfer, or measured concurrency/remote-coordination need.
- Reject unknown state/contract versions; add migration only when a second real version requires it.
- Retire or explicitly migrate incompatible predecessors. Inline or delete the kernel when a thinner boundary passes every hard invariant without hidden state or human memory.

### Verification receipts

- [Throwaway harness-authoring teaching-flow prototype](../prototypes/08-harness-authoring-teaching-flow.throwaway.html) — six deterministic paths; SHA-256 `4bad86373b1b3310797a7597f85894a29b19310b259d601321998adcf343ee47`.
- [`DEC-harness-authoring-teaching-skill-contract`](../../../.ariadne/GRAPH.jsonl) records the locked teaching contract.
- [`VAL-SELECT-harness-authoring-teaching-skill`](../../../.ariadne/GRAPH.jsonl) records the hard-requirement filter and adversarial critique.
- [`DEP-harness-authoring-bootstrap-boundary`](../../../.ariadne/GRAPH.jsonl) records the build/runtime coupling and state owners.
- [`EVD-harness-authoring-teaching-flow-prototype-r3`](../../../.ariadne/GRAPH.jsonl) records the Rung 3 prototype result.
- [`OBS-harness-authoring-post-evidence-gate`](../../../.ariadne/GRAPH.jsonl) records that ticket-local checks pass while two unrelated repository-wide epistemic diagnostics remain open.

Tickets 09–11 retain real adapter contracts, recovery/security semantics, contract integration, clean-session completion, transfer, and cross-host evidence. Reopen this decision if a responsibility lacks one owner, a clean-session learner needs oral guidance, supported hosts cannot resolve the pointer contract, any invalid path passes, live recursion appears, or the thin baseline passes all full-destination invariants.
