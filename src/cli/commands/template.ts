import { hasHelp, type CliIO } from "../workspace.js";

export type TemplateType = "FRAME" | "DIAG" | "LEAN-TASK" | "TRANS";

const TEMPLATES: Record<TemplateType, string> = {
  FRAME: `# FRAME-[YYYY-MM-DD]-[DOMAIN]-[ID]: [Brief Title]

## 1. Request Deconstruction
- **Raw Request**: [Verbatim request]
- **Embedded Premature Solution**: [Implementation bias]
- **True Implementation-Agnostic Function**: [Verb + object + constraint]

## 2. Behavioral Specification Tuple (C, E, O, M, I)
- **Operating Conditions (C)**: [Load, failures, concurrency]
- **Triggering Event (E)**: [Event]
- **Required Outcome (O)**: [State transition or response]
- **Quantitative Measurement (M)**: [Bounded metric]
- **Guaranteed Invariant (I)**: [Safety or liveness property]

## 3. Boundary Scope Variations
- [Boundary level and trade-off]

## 4. Multi-Perspective Analysis
- **User**: [Need]
- **Operator**: [Need]
- **Adversary**: [Abuse or failure case]

## 5. Formal Re-Framed Problem Statement
> Under [C], when [E] occurs, the system must [O] within [M] while preserving [I].
`,
  DIAG: `# DIAG-[YYYY-MM-DD]-[DOMAIN]-[ID]: [Brief Title]

## 1. Empirical Observations & Symptoms
- **OBS-01**: [Measured symptom and conditions]

## 2. Causal Hypotheses Tree
- **HYP-01**: [Falsifiable causal mechanism]
- **Evidence**: [Observation or trace]

## 3. Binding System Constraint
- **Constraint**: [Single limiting resource or law]
- **Exploitation**: [How it is used or wasted]

## 4. Formal Engineering Contradictions
- **CTR-01**: Improving [parameter] worsens [parameter].
- **Physical contradiction**: [Parameter] must be both [state A] and [state B].

## 5. Hidden Assumptions
- **ASM-01**: [Unverified premise]

## 6. Differentiating Falsification Tests
| Hypothesis | Experiment | TRUE result | FALSE result |
|---|---|---|---|
| HYP-01 | [Executable test] | [Expected] | [Expected] |
`,
  "LEAN-TASK": `# LEAN-TASK-[YYYY-MM-DD]-[ID]: [Brief Title]

## 1. Task Passport & Invariants
- **Problem**: [Observed symptom and impact]
- **Behavioral Delta (C, E, O, M, I)**: [Bounded change]
- **Boundary**: [Files and modules in scope]

## 2. Diagnosis & Causal Hypothesis
- **HYP-01**: [Falsifiable root-cause mechanism]
- **Supporting Evidence**: [Log, trace, or test]

## 3. Evaluated Candidates
- **CAN-01**: [Conventional mechanism]
- **CAN-02**: [Structural transformation]
- **Selected**: [Candidate and justification]

## 4. Executable Verification
- **Verification Command**: [Command]
- **Pass Criteria**: [Observable success]
- **Falsification Criteria**: [Observable failure]

## 5. Decision & Outcome
- **Status**: [RESOLVED | FAILED | ESCALATED]
- **Rollback Procedure**: [Revert or recovery action]
`,
  TRANS: `# TRANS-[YYYY-MM-DD]-[DOMAIN]-[ID]: [Transition Plan Title]

## 1. System Evolution Endpoints
- **Current State (S0)**: [Existing architecture]
- **Target State (S1)**: [Target architecture]

## 2. Temporary Transition Architecture
- [Shim, adapter, feature flag, or dual-write path]

## 3. Phased Migration Execution
1. **Phase 1**: [Shadow or preparation]
2. **Phase 2**: [Canary and measured ramp]
3. **Phase 3**: [Completion gate]

## 4. Automated Rollback Triggers & Procedure
| Trigger | Condition | Action |
|---|---|---|
| ROLL-01 | [Invariant breach] | [Rollback action] |

## 5. Decommissioning Criteria
- [ ] [Temporary mechanism is removed after verification]
`,
};

const TEMPLATE_USAGE = "Usage: ariadne template <FRAME|DIAG|LEAN-TASK|TRANS>\n";

const parse = (args: readonly string[]): TemplateType => {
  if (args.length !== 1) throw new Error(TEMPLATE_USAGE.trim());
  const type = args[0].toUpperCase() as TemplateType;
  if (!(type in TEMPLATES)) throw new Error(`Unknown template: ${args[0]}`);
  return type;
};

export function runTemplate(args: readonly string[], io: CliIO): number {
  if (hasHelp(args)) {
    io.stdout.write(TEMPLATE_USAGE);
    return 0;
  }
  io.stdout.write(TEMPLATES[parse(args)]);
  return 0;
}
