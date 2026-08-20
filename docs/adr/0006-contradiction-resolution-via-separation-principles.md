# 0006. Contradiction Resolution via Separation Principles

## Context and Decision
Software engineering problems frequently encounter competing quality requirements ($P_1 \uparrow \implies P_2 \downarrow$, such as high consistency vs. low latency, or strict type safety vs. runtime extensibility). Standard industry practice relies on compromises, weighted scoring, or accepting permanent degradation.

We decided that Ariadne will treat contradictions as first-class architectural entities (`CTR-`) and resolve them through the 4 systematic separation principles (separation in time, in state ownership, in operating conditions/modes, and across system boundaries) rather than accepting compromise solutions.

## Consequences and Trade-offs
- Eliminates permanent architectural debt and hidden trade-offs by identifying structural seams.
- Requires agents to generate $\ge 3$ distinct structural candidate mechanisms (`CAN-`) under different separation principles rather than tweaking single parameters.
- Increases initial framing and exploration overhead for complex features, but guarantees higher long-term ideality and modular independence.
