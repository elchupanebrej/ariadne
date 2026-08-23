# Design staged self-application and fixed-point verification

Type: prototype
Status: resolved
Blocked by: 03, 04
Parent: [Methodological Harness System](../map.md)

## Question

What exact versioned bootstrap, artifact flow, stopping rule, and equivalence check take methodology-authoring v0 through harness-authoring and the Orchestration Harness to a stable v1 satisfying `F(M) ≡ M`, while keeping runtime dependencies acyclic and empirical validation separate?

## Comments

## Answer

Use **owner-gated immutable bootstrap rounds**. Recursive work happens between pinned build stages and complete assessment runs, never through components rewriting or invoking their active builders.

### Versioned bootstrap

`b_n` is an immutable round label and provenance key, not a compatibility promise. Every input and output is pinned by component version and byte digest in one `bootstrap.lock`.

| Stage | Pinned inputs | Output |
|---|---|---|
| 0. Freeze method | current guide snapshot `G_n` | draft Method Contract `M_n` |
| 1. Teach method authoring | `G_n`, `M_n` | Methodology Authoring Teaching Skill `MA_n` |
| 2. Teach harness authoring | `G_n`, `M_n`, `MA_n`, pinned harness research | Harness Authoring Teaching Skill `HA_n` |
| 3. Build orchestration | `M_n`, `HA_n`, owner adapter contracts | Orchestration Harness `OH_n` |
| 4. Self-apply twice | the same lock containing `G_n`, `M_n`, `MA_n`, `HA_n`, `OH_n`, and adapters | isolated assessment bundles `S_n^A` and `S_n^B` |
| 5. Promote | one fixed round with two passing bundles | structural-v1 release set |

The build provenance is:

```text
Guide -> Method Contract -> methodology-authoring -> harness-authoring -> Orchestration Harness
```

The self-application runtime graph is smaller and acyclic:

```text
Orchestration Harness -> owner adapter -> methodology-authoring -> pinned Method Contract
```

Harness-authoring is a build-time input to the Orchestration Harness, not a runtime callback. The Method Contract and authoring skills never invoke or rewrite the active harness. The harness owns attempt pointers and gates only; the Method Contract owner owns normative changes.

### Required self-application bundle

`OH_n` coordinates two complete applications of `M_n` to itself. Assessment A and assessment B use identical pins, run in isolated contexts, cannot read one another's artifacts, and record the assessor/context and degree of independence.

Each assessment emits owner pointers to:

- the methodology's own schema-valid A0 and A1–A7 instance;
- the 49-item audit and B1–B7 leave-one-out results;
- the A1–A7 normative-change propagation matrix;
- a complete Method Contract candidate, not only a patch;
- its normalized `P/A/R/L` projection and diff against `M_n`;
- pin, completion, no-circular-validation, and independence receipts.

### Exact equivalence check

For the two independently produced candidates:

```text
N(F_A(M_n)) = N(M_n) = N(F_B(M_n))
```

`N` projects the Method Contract into the guide's normative core:

- `P`: normative principles, metaclaims, boundaries, and assumptions represented through A2;
- `A`: A0 and A1–A7 operational roles and schemas;
- `R`: rule records, completion profiles, verification hooks, and normative lifecycle policies;
- `L`: stable rationale references, effect targets, artifact dependencies, and other normative links.

Normalization removes only release-instance metadata such as the round/version label, digest, status transition, timestamps, assessor identity, and receipt IDs. It ignores object-key order and order in fields declared to be sets, but preserves action, branch, effect, and other executable ordering. Guide wording and examples remain outside the projection, while unresolved rationale links fail the check.

A changed schema, rule, completion predicate, hook, lifecycle policy, or normative link is a core change by default. The checker does not attempt general logical equivalence of JSON Schemas; a structurally different schema therefore yields a safe false negative and requires owner review in a new round.

### Stopping rule

The current round succeeds only when both assessments are complete, independent, pin-matched, mutually agreeing, and equal to the input projection, with every static self-consistency condition satisfied and no unresolved stop.

Any other result stops immediately:

- an agreed normative delta means `M_n` is not a fixed point; the Method Contract owner may accept it into a new immutable round `b_(n+1)`, run A1–A7 propagation, repin or rebuild affected consumers, and repeat both assessments;
- assessor disagreement or ambiguous core/presentation classification stops for owner resolution and cannot start a new round automatically;
- pin drift, invalid artifacts, missing independence, human/approval boundaries, or a runtime cycle fail closed;
- the harness never loops to convergence and never rewrites its active inputs.

On success, the structural-v1 release set points to the fixed round and records **structural closure: passed**, **fixed point: passed**, and the empirical status separately. Self-application does not satisfy an external-verification hook, raise an A2 evidence class, prove teaching effectiveness, or prove runtime/adaptor fitness.

Ticket 12 still owns component version relationships, compatibility, migration, and retirement. Tickets 07–09 own the teaching-skill and adapter details; ticket 11 owns clean-session and empirical evaluation. This ticket fixes their required pins, receipts, dependency directions, and gates.

### Prototype and Ariadne receipts

- [Throwaway staged self-application prototype](../prototypes/05-staged-self-application.throwaway.html) — deterministic stable, presentation-only, normative-delta, disagreement, pin-drift, runtime-cycle, and false-proof paths; SHA-256 `b44d500ff2b5f5d8edd565fafce4ffe106fcd008a6d7f32a54ec5b6f98e34938`.
- [`DEC-staged-fixed-point-contract`](../../../.ariadne/GRAPH.jsonl) records the locked operational contract.
- [`VAL-SELECT-staged-fixed-point-contract`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate filter and adversarial critique.
- [`EVD-staged-fixed-point-prototype`](../../../.ariadne/GRAPH.jsonl) records the Rung 3 prototype result.
