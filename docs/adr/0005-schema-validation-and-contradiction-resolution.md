# 0005. Schema Validation, Contradiction Resolution, and Downstream Handoff

## Context and Decision
To ensure end-to-end reliability of the Ariadne reasoning engine, we established:
1. **Schema Validation via Zod**: All epistemic nodes, graph relations, and state files are validated at runtime using Zod, generating JSON Schemas for external tool interop and ensuring strict TypeScript type inference (`z.infer`).
2. **Contradiction Resolution via Four Separation Principles**: In strict alignment with the 9 Operations methodology, contradictions (`CTR-`) are resolved by eliminating conflicts across four axes (time, state/data, operating modes, system boundaries) rather than accepting compromise or trade-off averaging.
3. **Adaptive Downstream Handoff**: Once epistemic uncertainty is resolved and decisions (`DEC-`) are locked:
   - Bounded / localized tasks hand off directly to `implement` (or `gsd-executor`).
   - Architectural / multi-phase changes hand off to `to-spec` -> `to-tickets` -> `implement`.

## Consequences and Trade-offs
- Guarantees schema correctness across CLI and direct-file fallback modes.
- Prevents weak compromises in architectural decisions by enforcing systematic separation techniques.
- Minimizes process friction for minor changes while ensuring specification rigor for major systems.
