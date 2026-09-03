# Modern Agent Harness Construction: Boundary Decision for Ariadne

**Status:** decision-ready research
**As of:** 2026-08-22
**Question:** Do current agent-harness practices justify a new neutral Orchestration Harness alongside Matt Pocock Skills and Ariadne, or can an existing skill loader plus the Ariadne CLI provide the required behavior?

## Executive verdict

The evidence **conditionally supports a new neutral Orchestration Harness**. The condition is important: the destination must require enforceable, reproducible execution across fresh sessions, including pause/resume, failure recovery, permission decisions, and run-level traces. A skill loader and Ariadne are sufficient for instruction discovery plus epistemic reasoning state; they are not, by themselves, an execution lifecycle.

The recommended system is a **small neutral orchestration kernel with host adapters**, not a new agent framework:

- keep methodology content and worked examples in versioned Agent Skills;
- keep claims, evidence, invalidation, and decision-significant unknowns in Ariadne;
- keep issue/work planning in the existing tracker and Matt Pocock Skills;
- let the host keep its model loop, tools, sandbox, and native approval UI;
- add only the missing cross-session contract: run state, ordered context manifest, artifact envelopes, lifecycle transitions, recovery policy, normalized approval events, and trace export.

This boundary is an **inference from the sources and the inspected repository**, not a fact established by an industry standard. Modern runtimes independently implement those lifecycle duties: OpenAI's Agents SDK has sessions, serializable `RunState`, approval interruptions, and tracing; LangGraph uses checkpoints, thread identifiers, interrupts, and replay rules; OpenAI Symphony owns dispatch, reconciliation, workspaces, retries, and status. Those implementations demonstrate that the duties are real, while also warning against rebuilding them when a chosen host already exposes them. [OpenAI Agents SDK: sessions](https://openai.github.io/openai-agents-python/sessions/), [OpenAI Agents SDK: human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/), [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md)

## What the primary sources establish

### 1. Context assembly should be progressive, addressable, and versioned

The Agent Skills specification defines a three-tier loading model: skill metadata at startup, the full `SKILL.md` only on activation, and referenced resources only when needed. Its client guide says the minimum skill record is name, description, and location, and it permits ordinary file reads as the activation mechanism; no separate skill runtime is required. [Agent Skills specification](https://agentskills.io/specification), [Agent Skills client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)

OpenAI's harness-engineering report independently describes the same shape at repository scale: a short entry document acts as a map, deeper repository documents are the versioned system of record, and mechanical checks catch drift. It also reports isolated per-worktree application and observability environments so the agent can inspect the actual system. [OpenAI: Harness engineering](https://openai.com/index/harness-engineering/)

Anthropic describes context engineering as curating the entire changing inference context, not just writing a system prompt, and recommends just-in-time retrieval through stable pointers such as file paths, stored queries, and links. [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**Implication for this project:** do not concatenate the methodological guide, Ariadne rules, every Matt skill, and run history into one prompt. The orchestration contract should record an ordered list of content-addressed pointers and disclose only the next required resource. The existing skill loader should continue to perform skill discovery and activation.

### 2. Tool and skill routing need distinct control semantics

The Agent Skills client guide says most clients let the model choose a skill from the startup catalog and activate it by file read or a dedicated activation tool. This is instruction routing, not durable workflow scheduling. [Agent Skills client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)

MCP explicitly separates user-controlled prompts, application-controlled resources, and model-controlled tools. Tool definitions carry JSON Schema inputs and may carry output schemas; the specification also says human denial should remain possible and tool annotations are untrusted unless their server is trusted. [MCP server primitives](https://modelcontextprotocol.io/specification/2025-06-18/server/index), [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

Anthropic distinguishes deterministic workflows, whose route is encoded in code, from agents, whose route is chosen by the model. It recommends starting with the simplest composition that works and adding agentic complexity only when needed. [Anthropic: Building effective AI agents](https://www.anthropic.com/engineering/building-effective-agents)

**Implication:** methodology-selection may remain model-driven, but lifecycle transitions and safety invariants must be deterministic. A model may recommend the next methodological operation; it must not invent valid run states, approve its own privileged operation, or silently skip an artifact gate.

### 3. State needs one explicit owner per concern

MCP assigns connection lifecycle, permissions, consent, authorization decisions, and context aggregation to the host; each client maintains an isolated stateful connection to one server. [MCP architecture](https://modelcontextprotocol.io/specification/2025-06-18/architecture)

OpenAI's Agents SDK separates conversation sessions from serializable paused-run state. Its HITL flow can serialize a `RunState`, persist approval decisions, and resume later; the documentation recommends storing an agent/SDK version marker beside long-lived pending state because prompts, models, and tool definitions may change. [OpenAI Agents SDK: human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/)

LangGraph checkpoints graph state by thread and uses the thread identifier as the resume pointer. It also distinguishes per-invocation, per-thread, and stateless subgraphs so memory scope is chosen explicitly rather than inherited accidentally. [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [LangGraph subgraph persistence](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)

The local Ariadne sources define and implement another, orthogonal owner: the epistemic graph. The skill routes uncertainty to operation-specific rules, while the controller persists graph nodes and projects/ingests artifacts; the CLI exposes graph, gate, invalidation, operation, and ingest commands. It does not expose a general session scheduler, approval broker, or attempt lifecycle. [Ariadne skill](../../.agents/skills/ariadne/SKILL.md), [Ariadne controller](../../src/harness/controller.ts), [Ariadne CLI](../../src/cli/index.ts)

**Implication:** use separate state namespaces and explicit references, not mirrored state:

| Concern | Canonical owner |
|---|---|
| Method content, examples, templates | versioned methodology skill package |
| Epistemic claims, evidence, invalidation | Ariadne graph |
| Work map, tickets, claims, dependencies | existing issue tracker / Matt skills |
| Model conversation and native tool calls | host runtime |
| Cross-session run cursor, attempts, artifact completion, recovery | neutral Orchestration Harness |

### 4. Artifact contracts are the bridge across sessions

Anthropic's long-running-agent work found that fresh contexts need repository-visible progress plus version-control history; later work carried context through structured artifacts and used explicit generator/evaluator sprint contracts that defined “done” before execution. [Anthropic: Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)

LangGraph requires JSON-serializable entrypoint inputs and task outputs for checkpointing and restoration. MCP similarly supports structured tool results, declared output schemas, and resource links rather than requiring all data to be copied into prose. [LangGraph Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api), [MCP tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

**Implication:** every methodology step that can cross a session boundary should emit a small machine-checkable envelope and place the human-readable artifact at a stable path. The envelope, not a chat summary, determines whether the next step is runnable.

### 5. Evals must grade trajectories and environment outcomes

Anthropic defines an agent eval as a task plus repeated trials, graders, the full trajectory/trace, and the final environment outcome. It stresses that an agent evaluation measures the harness and model together, and that multiple trials are needed because outputs vary. [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

SWE-bench makes evaluation environments reproducible with per-task Docker images, applies the produced patch, runs tests, and stores logs and final evaluation results. The relevant lesson is isolation plus outcome grading, not Docker as a universal requirement. [SWE-bench evaluation harness](https://github.com/SWE-bench/SWE-bench/blob/main/docs/reference/harness.md)

Anthropic's 2026 harness work also warns that every harness component encodes an assumption about model limitations and should be removed one at a time under evaluation to identify what is load-bearing. [Anthropic: Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)

**Implication:** evaluate the methodology harness using clean processes and repository outcomes, not by asking an agent whether it understood the method. Run the thin baseline, host-specific alternative, and neutral runtime against the same fixtures and model/tool configuration.

### 6. Observability should capture lifecycle, not default to raw secrets

The OpenAI Agents SDK traces model generations, tool calls, handoffs, guardrails, and custom events under trace/span identifiers, with configuration for sensitive data. [OpenAI Agents SDK tracing](https://openai.github.io/openai-agents-python/tracing/)

OpenTelemetry's generative-AI conventions define common attributes for agent identity/version, conversation identity, workflow name, tool execution, and token usage, while warning that tool arguments/results and workflow names may contain sensitive material. [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

Symphony requires issue/session context in structured logs, records retry and token/rate-limit state, and keeps status presentation derived from orchestrator state rather than making the UI part of correctness. [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md)

**Implication:** emit normalized metadata events by default and keep prompt/tool payload capture opt-in. Correlate host-native traces with harness `run_id`, `attempt_id`, methodology step, artifact IDs, and Ariadne node references.

### 7. Recovery semantics belong in executable orchestration

LangGraph persists checkpoints at step boundaries and pending writes within a step. Its guidance requires non-determinism to be wrapped as tasks and side-effecting tasks to be idempotent because resumption may replay work. [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [LangGraph Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api)

Symphony serializes orchestration mutations through one authority, reconciles external tracker state before dispatch, distinguishes successful, failed, timed-out, stalled, and canceled attempts, and uses bounded exponential backoff for failure retries. It deliberately reconstructs restart state from the tracker and filesystem rather than adding a database. [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md)

**Implication:** a prose-only skill cannot enforce exactly-once effects or reliable resume. The minimal runtime should use atomic files and idempotency keys, automatically retry only operations declared replay-safe, and require inspection or approval before retrying an ambiguous side effect.

### 8. Permissions and security are host duties with harness policy inputs

MCP assigns consent and connection permissions to the host and says tool annotations are not trustworthy unless their server is trusted. Its HTTP authorization rules bind access tokens to their intended resource and prohibit passing a client token through to an upstream service. [MCP architecture](https://modelcontextprotocol.io/specification/2025-06-18/architecture), [MCP authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)

The Agent Skills client guide warns that repository-provided skills can inject instructions and recommends a project trust check before loading them. [Agent Skills client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)

Symphony adds concrete filesystem invariants: agent working directories remain inside a configured workspace root, identifiers are sanitized, credentials stay in the host process rather than the child agent environment, and arbitrary workflow hooks are treated as trusted code with timeouts. [Symphony specification](https://github.com/openai/symphony/blob/main/SPEC.md)

**Implication:** the neutral runtime records policy and approval state but delegates enforcement to the host adapter. It must never downgrade a host sandbox or approval requirement. Skills, methods, hooks, and adapters are versioned executable inputs and need a trust decision before use.

### 9. Lifecycle and compatibility must be negotiated or pinned

MCP initialization negotiates a protocol version and capabilities before normal operation; peers must only use negotiated features and should disconnect on unsupported versions. [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)

OpenAI's paused-run documentation recommends storing version markers beside durable state. Agent Skills supports a metadata version but does not define orchestration-state migration. [OpenAI Agents SDK: human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/), [Agent Skills specification](https://agentskills.io/specification)

**Implication:** each run must pin the method contract digest, skill package digest, harness schema version, adapter ID/version, Ariadne schema/CLI version, and host/model configuration. Version 1 should reject unknown state versions with a useful error; do not build a migration framework until a second schema exists.

## Boundary options

| Option | What it owns | Strengths | Failure modes | Verdict |
|---|---|---|---|---|
| **A. Dedicated neutral runtime** | Cross-session run cursor, attempts, artifact gates, recovery, approval normalization, trace correlation; delegates model/tools to host | Host-independent contract; executable clean-session behavior; one place for invariants and eval fixtures | Can duplicate host SDKs, grow into a second agent framework, or shadow Ariadne/tracker state | **Recommended, with a deliberately narrow kernel** |
| **B. Thin existing-runtime package** | Skills, method contract, examples, templates, Ariadne CLI calls; human/host owns continuity | Smallest implementation; uses the Agent Skills standard; easiest to inspect | Cannot guarantee resume, retry, permission, or trace behavior across hosts; chat summaries become hidden state | Keep as the **baseline and deletion target** for the runtime hypothesis |
| **C. Host-specific plugin** | Same lifecycle duties implemented through one host's hooks/session/approval APIs | Maximum leverage from native session state, sandbox, approvals, and tracing; lowest initial integration cost | Behavior and artifact semantics drift per host; self-bootstrap becomes tied to one product | Prefer if only one host is a real requirement; otherwise use as an adapter, not the canonical contract |
| **D. Put orchestration inside Ariadne** | Epistemic and operational state in one package | One installable component | Conflates evidence/decision semantics with attempts, retries, and permissions; creates shadow state against Ariadne's overlay role | Reject |

Option A is not evidence-backed merely because sophisticated products have orchestrators. OpenAI and Anthropic both advise beginning with simple, composable mechanisms, while the current Agent Skills loader already solves discovery and progressive disclosure. The runtime is justified only by the cross-session invariants that cannot be expressed or tested as content alone. [Anthropic: Building effective AI agents](https://www.anthropic.com/engineering/building-effective-agents), [Agent Skills client implementation guide](https://agentskills.io/client-implementation/adding-skills-support)

## Recommended minimal architecture

```text
methodology skill ──content/digest──┐
Matt skills + tracker ──work refs──┤
Ariadne CLI ──epistemic refs/gates─┤
                                   v
                        Orchestration Harness
                   run cursor / artifact gates / policy
                                   |
                            host adapter API
                                   v
                 existing host runtime / model / tools
```

### Kernel responsibilities

1. Load one `run.json` and append lifecycle events to `events.jsonl`.
2. Validate the pinned method and adapter capabilities before starting or resuming.
3. Assemble an ordered context manifest of pointers and digests; do not store an opaque mega-prompt as canonical state.
4. Launch/resume/cancel through a host adapter and normalize lifecycle events.
5. Validate required artifact envelopes before advancing the cursor.
6. Persist pending approval references and pass decisions back to the host.
7. Apply retry policy according to declared replay safety.
8. Export trace correlation metadata.

### Explicit non-responsibilities

- no second skill discovery system;
- no new model/tool loop;
- no MCP reimplementation;
- no issue tracker clone;
- no duplicate epistemic graph;
- no generic distributed scheduler, database, queue, or plugin marketplace in version 1.

### Filesystem contract

Reuse the repository as the durable substrate, consistent with current harness practice and Ariadne's existing file-backed graph:

```text
.harness/runs/<run-id>/
├── run.json                 # atomic current snapshot
├── context.json             # ordered content-addressed pointers
├── events.jsonl             # append-only normalized lifecycle events
├── artifacts/
│   └── <artifact-id>.json   # machine-checkable envelopes
└── outputs/                 # human-readable step outputs
```

Minimal `run.json` fields:

```json
{
  "schema_version": 1,
  "run_id": "run_...",
  "status": "waiting",
  "step": "validate-example",
  "attempt": 2,
  "method": {"id": "methodology-authoring", "version": "0.1.0", "sha256": "..."},
  "adapter": {"id": "codex", "version": "..."},
  "workspace": {"path": "...", "revision": "..."},
  "ariadne_refs": ["EVDREQ-..."],
  "pending": {"kind": "approval", "external_id": "..."},
  "updated_at": "2026-08-22T00:00:00Z"
}
```

Minimal artifact envelope:

```json
{
  "schema_version": 1,
  "artifact_id": "artifact_...",
  "kind": "worked-example",
  "producer": {"run_id": "run_...", "step": "author-example", "attempt": 1},
  "inputs": [{"path": "method-contract.md", "sha256": "..."}],
  "output": {"path": "outputs/worked-example.md", "sha256": "..."},
  "ariadne_refs": ["EVD-..."],
  "status": "complete"
}
```

Only `created`, `running`, `waiting`, `succeeded`, `failed`, and `canceled` are required initially. Attempt results carry `timeout`, `stall`, or `error` reasons without multiplying top-level states.

### Host adapter contract

The first adapter needs only five operations:

```text
capabilities() -> versions, resume, approvals, traces, sandbox
start(context_manifest, workspace, policy) -> external_run_id
resume(external_run_id, decision_or_input) -> external_run_id
cancel(external_run_id) -> result
events(external_run_id, cursor) -> normalized events
```

When a host already supplies durable sessions, approvals, retries, or traces, the adapter stores references to those native objects. The kernel must not copy their internal state. A fake adapter should exercise conformance tests before a second real host adapter is built.

## Clean-session reproducibility and eval plan

Run all candidates with the same pinned method contract, worked example, task fixtures, model configuration, tools, and repository revision. Start every trial in a new process with no conversation history. Use at least three trials per behavioral task, following the repeated-trial guidance for non-deterministic agents. Grade repository state and lifecycle events, then inspect traces only for diagnosis. [Anthropic: Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

Required fixtures:

1. **Cold start:** select and load the correct methodology resources from only the skill catalog and task.
2. **Worked example:** reproduce every required artifact and correctly link Ariadne evidence from the bundled short example.
3. **Mid-run reset:** terminate after one completed step; a fresh process must identify exactly one valid next step from persisted artifacts.
4. **Approval reset:** terminate while a privileged operation waits; a fresh process must preserve the pending decision and must not execute before approval.
5. **Crash after side effect:** simulate ambiguous completion; the runtime must not replay unless the operation is marked idempotent or an operator resolves it.
6. **Corrupt artifact:** alter a digest or omit a required field; advancement must fail closed with the artifact and expected contract named.
7. **Method upgrade:** resume with a changed method digest; the runtime must reject or explicitly start a new compatible run, never silently mix versions.
8. **Adapter conformance:** run the lifecycle against a fake adapter and the first production adapter; normalized state and artifact results must match.

Acceptance invariants:

- no prior chat transcript is needed to select the next step;
- no privileged call executes without the host's required approval;
- no non-replay-safe effect is automatically duplicated;
- every completed step has a schema-valid envelope whose digest matches its output;
- every normalized event has `run_id`, `attempt`, `step`, timestamp, and host correlation ID;
- Ariadne graph validation still passes and the runtime contains references, not copied epistemic claims;
- failed and resumed trials leave no writes outside the assigned workspace.

Compare these variants:

- **baseline:** existing skill loader + method skill + Ariadne CLI, with a human starting fresh sessions;
- **host plugin:** one host's native hooks/session state;
- **neutral kernel:** the same host through the adapter contract.

The neutral runtime earns permanence only if the baseline or plugin cannot satisfy the required invariants without undocumented human memory or host-specific artifact semantics. Performance improvement alone is insufficient; portability, recoverability, or enforceability must be demonstrated.

## Decision-significant uncertainties and falsifiers

| Hypothesis | Current status | Falsifier / decisive test |
|---|---|---|
| A neutral runtime is necessary for clean-session methodology execution | **Supported, not proven** by the separation between skill loading, epistemic state, and runtime lifecycle | The thin baseline passes all cold-start, reset, approval, replay, version, and artifact invariants with no manual state outside repository artifacts |
| The runtime must be host-neutral | **Required by the stated destination**, not by industry evidence | Product scope commits to one host for the lifetime of the method, and the host plugin exposes stable sessions, approvals, traces, and artifact hooks |
| A new agent loop is needed | **Unsupported** | No falsifier needed before implementation; existing hosts and SDKs already own the loop. Revisit only if a required host lacks start/resume/events primitives |
| Files are sufficient runtime storage | **Plausible for v1**; Symphony demonstrates restart recovery from tracker/filesystem without an orchestration database | Concurrent writers, remote workers, or measured corruption/recovery needs cannot be handled by atomic write plus single-writer locking |
| Full raw prompt/tool tracing is needed | **Unsupported and security-costly** | A diagnosed failure class cannot be reproduced from normalized events, artifact digests, and opt-in sampled payloads |
| Context reset is always beneficial | **Falsified as a universal rule**; Anthropic removed resets when a newer model plus compaction made them unnecessary | Keep reset as an eval condition for reproducibility, not a mandatory production behavior. Model-specific evals decide whether to use it during long runs |

## Implementation order

1. Freeze the versioned method contract, short worked example, and artifact schemas as ordinary skill resources.
2. Implement the clean-session baseline and fixtures before a runtime.
3. Add a file-backed run ledger plus fake adapter; implement only the six lifecycle states and artifact gates.
4. Add one production host adapter using native session, approval, sandbox, and trace features.
5. Run the three-way eval. Delete the kernel if it does not supply an invariant the thinner alternatives lack.
6. Add a second production adapter only when a real second host is in scope; until then, the fake adapter is enough to keep the boundary testable.

## Final decision statement

Proceed with the **neutral Orchestration Harness as a falsifiable, minimal kernel**. The evidence validates the boundary more strongly than it validates a particular implementation: instruction loading, epistemic reasoning, and operational execution are distinct concerns, and current successful harnesses make execution lifecycle explicit. The kernel should complement Matt Pocock Skills and Ariadne by owning only the operational seam neither owns. Its first deliverable is the baseline/eval contract; code follows only after the thin package demonstrably fails a required invariant.
