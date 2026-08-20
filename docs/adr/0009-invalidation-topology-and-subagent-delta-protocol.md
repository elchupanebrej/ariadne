# 0009. Invalidation Topology, Test Adapters, and Subagent Delta Protocol

## Context and Decision
Ariadne requires deterministic propagation of empirical falsification across the epistemic graph, standard execution of empirical test runners across multi-language repositories, and a structured protocol for subagents to contribute reasoning without corrupting graph state.

We decided to:
1. **Enforce Strict DAG Invariants on Derivation Edges**:
   - Forbid cycles on deductive edges (`derived_from`, `depends_on`) at registration time using topological cycle detection in code.
   - Execute transitive invalidation via a single-pass reverse topological sweep ($\mathcal{O}(V + E)$), marking dependent nodes as `NEEDS_REVIEW` immediately upon antecedent falsification.
   - Genuine circular tensions must be framed explicitly as `Contradiction` (`CTR-*`) nodes rather than circular deductive derivations.
2. **Standardized Test Runner Adapters with Universal Fallback**:
   - Provide built-in CLI parsers for standard test/benchmark output formats (JUnit XML, TAP, JSON reporters for `vitest`, `pytest`, `cargo test`, `go test`).
   - Extract pass/fail verdicts, execution durations, and MSI (Mutation Score Indicator) deterministically.
   - Fall back to process exit codes and regex metric extraction when specialized adapters are not available.
3. **Schema-Validated `EpistemicDelta` Envelopes for Ephemeral Subagents**:
   - Require ephemeral subagents to return modifications inside a typed JSON envelope (` ```json ariadne-delta ... ``` `).
   - Validate proposed node creations and edge mutations against Zod schemas before committing them to `GRAPH.jsonl`.

## Consequences and Trade-offs
- Guarantees predictable, cycle-free invalidation performance and eliminates infinite loop bugs in graph traversal.
- Eliminates reliance on probabilistic LLM parsing of verbose test logs.
- Protects `GRAPH.jsonl` integrity from malformed subagent responses.
