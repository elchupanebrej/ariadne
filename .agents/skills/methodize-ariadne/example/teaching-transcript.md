# Ariadne Cold-Start Transcript

Complete teacher + learner session for training a fresh agent. Read it
top-to-bottom **as if it were your own output**: Part 1 is what you were
taught, Part 2 is what a fresh agent then produced unaided. When facing an
Ariadne-needed task, imitate Part 2's shape: route first, load only the rule
file each branch needs, emit cards, execute real checks, cite evidence before
locking decisions.

Verified reproducible:

```sh
node .agents/skills/methodize-ariadne/example/check.mjs   # worked example gate passes
node /tmp/opencode/urlparams-check.js                 # Exercise A evidence (recreate if absent)
```

---

# Part 1 — Teacher log (Lesson 1)

## Step 1: The task comes first

> A request proposes adding a package to parse `KEY=VALUE` lines. Preserve the existing format, split on the first `=`, retain later `=` signs in the value, reject an empty key or missing delimiter, add no dependency unless required.

No terminology needed yet. Notice the trap: **the request names a mechanism ("a parsing package") instead of stating behavior**. That observation is the whole skill.

## Step 2: Route, don't memorize

Ariadne is a router, not a rulebook dump. `.agents/skills/ariadne/SKILL.md`: ten numbered branches, **load only the rule that matches the current branch**.

## Step 3: Uncertainty ingress (`rules/05-uncertainty.md`)

The task has a decision-significant unknown — *which mechanism parses the lines* — so the preflight applies: frame the uncertainty in one sentence **without naming a mechanism as fact**, persist small cards, route onward. Do not manufacture a decision just to enable a handoff.

## Step 4: Frame (`rules/10-frame.md`, `rules/00-core.md`)

Frame separates **behavioral requirement** from **proposed mechanism** and MUST NOT decide the mechanism:

| | |
|---|---|
| Proposed mechanism (not decided) | "a parsing package" |
| Required behavior | Given a well-formed line, return key + value; reject empty key / missing delimiter observably |

`00-core.md` adds invariants carried everywhere: the Problem State Tuple, the provenance lattice (`UNKNOWN ⊏ ASSUMED ⊏ PROPOSED ⊏ DERIVED ⊏ MEASURED ⊏ FACT ⊏ DECIDED`), and the rule that an `ASSUMED` premise can never justify a locked decision.

## Step 5: Explore (`rules/40-explore.md`)

Generate **≥3 structurally distinct candidates across different Separation Principles** — three tuning knobs of one idea are *one* candidate. From `example/.ariadne/GRAPH.jsonl`:

- `CAN-first-delimiter-stdlib` — System Boundary (stdlib slicing inside the function)
- `CAN-json-input` — State/Data (change the input representation)
- `CAN-environment-boundary` — System Boundary (delegate ownership to env vars)

## Step 6: Value (`rules/80-value.md`)

Selection is **non-compensatory**: a failed hard requirement disqualifies a candidate *before* any scoring, and no score may resurrect it. In the graph's `VAL-SELECT`: JSON breaks format compatibility, env changes interface ownership — both filtered first. Only then is stdlib provisionally selected, followed by an Adversarial Critique.

## Step 7: Validate (`rules/90-validate.md`, `rules/evidence.md`)

Claims get an `EVDREQ-*` naming **claim class + minimum ladder rung**, then an `EVD-*` receipt from actually running the check. Parsing logic = *Algorithmic logic* = Rung 3 (deterministic unit tests). The receipt cites 4 cases and a sha256 digest. Only **after** the receipt does `DEC-config-line-parser` lock, citing its evidence dependency.

## Step 8: Self-explanation

1. Why is "parsing package" a mechanism, not a requirement? *(05-uncertainty + 10-frame)*
2. Why were JSON/env rejected *before* preference scoring? *(80-value)*
3. Why does Rung 3 support this claim but could never prove distributed safety? *(evidence.md claim-class table)*
4. Why were Diagnose/Transform/Knowledge/Dynamics rules never loaded? *(router discipline)*

Then two exercises were assigned: **Exercise A** (faded practice — query-string parser; frame/candidates/hard requirements supplied, route withheld) and **Exercise B** (transfer — duplicate invoices after timeout inside a retry loop; no parser anywhere). Part 2 is the fresh agent's complete, unaided response.

---

# Part 2 — Learner log (fresh agent, verbatim)

Setup: loaded router `.agents/skills/ariadne/SKILL.md`. Discipline adopted: one branch → one rule file, loaded just before the step that needs it. Exercise A's frame/candidates/hard-requirements were supplied by the teacher, so `10-frame.md` was NOT loaded to re-derive them. Note: this is a read-only training sandbox, so cards are recorded inline; in a real run each card label would be a Markdown link to the persisted artifact (`GRAPH.jsonl`, `INDEX.md`, `STATE.yaml` per `rules/05-uncertainty.md`).

## EXERCISE A — Faded practice (query-string parser)

### [a] Hard-requirement filter
Action: filter the three supplied candidates against the three hard requirements before any preference comparison.
Rule file: `.agents/skills/ariadne/rules/80-value.md` (non-compensatory filter: "a candidate that fails a hard requirement is ineligible; its preference score MUST NOT restore it").

| Candidate | repeated keys survive | %20 decoded correctly | input format preserved | Verdict |
|---|---|---|---|---|
| CAN-A1: native URLSearchParams | believed pass (unverified) | believed pass (unverified) | pass (parses query strings in place) | **ELIGIBLE** |
| CAN-A2: hand-rolled split-&-then-= loop | pass if written carefully | easy to get wrong (`%20` vs `+`) | pass | **ELIGIBLE** |
| CAN-A3: switch inputs to JSON bodies | n/a (sidesteps parsing) | n/a | **FAIL — changes existing input format** | **DISQUALIFIED** |

CAN-A3 is removed before any scoring; no score may restore it (80-value.md negative example: "B scores 95 because it is cheap…" is invalid compensatory reasoning).

### [b] Evidence Request card
Rule file: `.agents/skills/ariadne/rules/evidence.md` ("An Evidence Request MUST name its claim class and minimum rung").

- **EVDREQ-01** — Verify URLSearchParams meets hard requirements
- claim: URLSearchParams preserves repeated keys, decodes `%20`, and keeps embedded `=` intact in values
- claim class: **Algorithmic logic** (deterministic parse behavior of a known algorithm)
- minimum rung: **Rung 3 (Example-Based Unit Tests)** — justification: the claim-class gate maps Algorithmic logic to Rung 3–4; behavior is deterministic with enumerable edge cases, so concrete examples suffice; Rungs 1–2 (inspection/types) can't observe runtime parse output; Rung 4 property-based generation adds cost without decision significance here. Insufficient-evidence column warns against happy-path manual runs.

### [c] Executed check
Rule file: none new — provider executes EVDREQ-01 per `evidence.md` lifecycle step 2.

Command: `node /tmp/opencode/urlparams-check.js` (script written under `/tmp/opencode/urlparams-check.js`; uses `node:assert`, three cases: `getAll('tag') === ['a','b']` on `?tag=a&tag=b`; `get('q') === 'hello world'` on `q=hello%20world`; `get('token') === 'abc=='` on `token=abc==&x=1`).

Output:
```
v26.3.1
PASS repeated keys preserved
PASS %20 decoded to space
PASS value containing '=' kept intact
3/3 cases passed
```

### [d] Evidence Result receipt
Rule file: `.agents/skills/ariadne/rules/evidence.md` ("A receipt records method, rung, verdict, reproducible environment").

- **EVD-01** — receipt for EVDREQ-01
- method: example-based assertions via `node:assert` over `URLSearchParams`
- rung: 3 (meets requested minimum — gate passes)
- verdict: **SUPPORTED** (all three cases pass; provenance of the belief rises to MEASURED for these behaviors)
- environment: Node v26.3.1, Linux (WSL), command reproducible

### [e] Decision card
Rule file: `.agents/skills/ariadne/rules/80-value.md` (step 6: DEC lock MUST cite passing hard requirements, evidence, critique result, owner; Epistemic Gate rejects a DEC lacking all three).

- **DEC-01** — Adopt CAN-A1 (native URLSearchParams) as the parser
- passing hard requirements: repeated keys ✓, %20 decoding ✓, input format preserved ✓
- evidence cited: EVD-01 (Rung 3, SUPPORTED)
- Adversarial Critique (attack/response): **Attack** — "URLSearchParams converts `+` to space, which differs from some legacy encoders; hidden behavior shift." **Response** — accepted as a known operating condition, not a hard requirement; add one regression case if a `+`-as-literal requirement ever appears; does not block selection.
- costs noted (80-value.md step 3): zero code/mutable-state cost, no dependency added, smallest change radius
- owner: training exercise (in production: named maintainer); status: LOCKED

Skipped per ponytail ladder: CAN-A2 entirely — stdlib covers it; revisit only if URLSearchParams hits a documented behavioral ceiling.

## EXERCISE B — Transfer (duplicate invoices after timeout inside retry loop)

### [f] Route decision
Rule file: `.agents/skills/ariadne/rules/05-uncertainty.md`.

Operation 05 (Uncertainty Ingress preflight) fires FIRST. Uncertainty signals present: a symptom whose causal mechanism is unproven ("duplicates observed"), a fact whose outcome changes the next action (if cause = retry-without-idempotency, fix differs from cause = broker redelivery), and competing candidate mechanisms. Preflight output: FRAME-B ("invoices must be created at most once per logical operation; currently violated after timeout+retry") + OBS-B ("duplicate invoices co-occur with network timeouts in a retry loop", workload/environment UNKNOWN until evidence). Route target per 05-uncertainty.md step 4: symptom + falsifiable causal hypotheses → `20-diagnose.md`. No fix before a falsifying check exists (20-diagnose.md MUST).

### [g] Causal hypotheses
Rule file: `.agents/skills/ariadne/rules/20-diagnose.md` (separate symptom from HYP; ≥2 materially different hypotheses; executable falsification predicates).

Key mechanism insight: a client timeout does NOT cancel server-side work. The first request keeps executing (or commits) after the client gives up; the retry loop then sends a second, identical request. Timeout ambiguity = the operation may have succeeded even though the client saw failure. Without an idempotency guard, both executions create invoices.

- **HYP-B1** — Server-side duplicate execution (at-least-once send, no dedup)
  - mechanism: attempt #1 reaches handler and creates invoice despite client timeout; retry sends identical payload; no idempotency key → second invoice created
  - invariant_violation: at-most-one invoice per logical operation
  - prediction: each duplicate pair correlates 1:1 with a logged retry event; suppressing retries removes duplicates
  - falsification_predicate: duplicates still occur in a controlled run with client retries disabled → HYP-B1 rejected
- **HYP-B2** — Duplicate source is upstream redelivery, not the HTTP retry loop (materially different alternative)
  - mechanism: a queue/broker between caller and invoicing service redelivers after a visibility/ack timeout; duplicates arrive even with zero client retries
  - prediction: duplicates carry broker redelivery markers and occur in runs with retry count = 0
  - falsification_predicate: with redelivery disabled and retries enabled, duplicates vanish → HYP-B2 rejected
- Both remain PROPOSED (never FACT) until EVD results exist (20-diagnose.md step 7).

### [h] Dynamics analysis
Rule file: `.agents/skills/ariadne/rules/70-dynamics.md`.

- **DYN-B1** — Retry-amplified duplication dynamics
- feedback loop (70-dynamics.md metastable check #1 matches verbatim): timeout → retry raises effective arrival rate λ above nominal; under load, higher λ raises latency, which triggers more timeouts → more retries: positive feedback, candidate retry storm / metastable state persisting after the original trigger clears
- stocks/flows: stock = in-flight requests + invoices being written; inflow = original arrivals + retries; outflow = completed/committed operations; unbounded inflow side (no retry budget) means the duplicate-producing path has no drain bound
- missing invariant #1: **idempotency/exactly-once effect** — no dedup key at the persistence boundary, so every replayed arrival is treated as a new operation
- missing invariant #2: **bounded retry policy** — no retry budget/backoff/jitter bounding the feedback loop
- result type to record once measured: fault injection or load observation (DYN card must state which)

### [i] Fix direction + proof requirements
Rule files: `.agents/skills/ariadne/rules/90-validate.md` (claim validation steps 1–4) and `.agents/skills/ariadne/rules/evidence.md` (claim-class gate).

Fix direction: **idempotency keys.** Client generates a stable key per logical operation (e.g., order UUID) and sends it on every attempt, including retries. Server persists key ↔ invoice mapping under a uniqueness constraint; on replay it returns the original result instead of creating again. This breaks the duplication mechanism for BOTH HYP-B1 (HTTP retries) and HYP-B2 (broker redelivery), and pairs with a retry budget to close the DYN-B1 feedback loop.

Claim to prove: "the fix guarantees at-most-one invoice per operation under timeout-and-replay conditions."
- claim class: **Distributed safety**
- minimum rung: **Rung 8 (Fault Injection & Chaos Testing)** — suitable evidence per evidence.md: fault/partition/recovery injection recording fault, scope, recovery, invariant result
- why a deterministic unit test is INSUFFICIENT: evidence.md's claim-class gate names "Local sequential test" as the insufficient-evidence entry for Distributed safety. A unit test is sequential and local: it never produces the actual failure signature — a timeout racing in-flight server work, a replayed request arriving concurrently or late, or partial failure between the server's commit and the client receiving its response. Those interleavings ARE the mechanism under test; a check that cannot interleave cannot falsify the hypothesis, so a green unit test proves nothing about the distributed-safety claim. Required check shape instead: inject a timeout after the first request commits but before its response reaches the client, replay with the same idempotency key, assert exactly one invoice exists (plus a negative control without the key asserting the duplicate reproduces).

## Rules loaded
- `.agents/skills/ariadne/SKILL.md` — router; always loaded first.
- `.agents/skills/ariadne/rules/00-core.md` — shared card vocabulary, ID prefixes, Provenance Lattice; needed by every step producing cards ([a]–[i]).
- `.agents/skills/ariadne/rules/80-value.md` — branch 8: candidate selection against hard requirements ([a], [e]).
- `.agents/skills/ariadne/rules/evidence.md` — graph/evidence invariant named by router footer: evidentiary ladder, claim classes, receipts ([b]–[d], [i]).
- `.agents/skills/ariadne/rules/05-uncertainty.md` — branch 0: decision-significant uncertainty ingress/routing ([f]).
- `.agents/skills/ariadne/rules/20-diagnose.md` — branch 2: symptom → falsifiable causal hypotheses ([g]).
- `.agents/skills/ariadne/rules/70-dynamics.md` — branch 7: retries/timeouts/queues/failure dynamics ([h]).
- `.agents/skills/ariadne/rules/90-validate.md` — branch 9: claim validation and rung selection for the fix-safety claim ([i]).

## Rules deliberately not loaded
- `10-frame.md` — Exercise A's frame was supplied by the teacher with instructions not to re-derive; Exercise B's frame was captured minimally inside the 05 preflight.
- `30-transform.md` — no branch asked me to transform or trim an existing mechanism; Exercise A selected among given candidates, Exercise B stopped at fix direction (pre-fix).
- `40-explore.md` — no structurally distinct candidates needed generating; both exercises supplied their candidates.
- `50-knowledge.md` — no decision-significant unknown was routed to knowledge lookup; A's unknowns were closed by direct execution (EVD-01), B's unknowns became HYP/EVDREQ targets instead.
- `60-dependencies.md` — neither case involved change coupling across components.
- `invalidation.md` — no EVD verdict came back FALSIFIED, so no Transitive Invalidation cascade was started.
- `roles.md`, `depth-modes.md`, `agent-rules.md` — no host-role negotiation, depth-mode escalation, or multi-agent handoff arose in this solo training task.
