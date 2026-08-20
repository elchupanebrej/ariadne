# 0003. CLI Command Architecture and Adversarial Critique

## Context and Decision
Ariadne must provide seamless interaction for both autonomous agents and human developers, while strictly enforcing Agent Rule 7 (Adversarial Critique before locking decisions) and ensuring zero-crash degradation across host environments.

We decided on:
1. **Hybrid Two-Level CLI**:
   - Primitive Graph Operations: `ariadne node ...`, `ariadne edge ...`, `ariadne verify ...`, `ariadne status`.
   - High-Level Workflow Macros: `ariadne op <frame|diagnose|transform|explore|knowledge|dependencies|dynamics|value|validate>`.
2. **Adaptive Degradation**:
   - Skills prioritize CLI commands when the binary is in `$PATH` or Node runtime is available.
   - If CLI execution is unavailable, skills fall back to direct file manipulation of `.ariadne/STATE.yaml` and `.ariadne/GRAPH.jsonl` following the normative schema.
3. **Hybrid Adversarial Critique**:
   - Mandatory CLI checklist enforcing scrutiny of complexity shifts, hidden state, and unverified assumptions.
   - Optional subagent prompt template for multi-agent hosts to run an independent adversarial critic in a fresh context.

## Consequences and Trade-offs
- Guarantees that neither single-agent setups nor constrained environments are blocked from using Ariadne.
- Ensures architectural candidates undergo structured hostile critique before decisions are finalized.
