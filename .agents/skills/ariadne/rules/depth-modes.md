# Epistemic Depth Modes

Depth Mode is orthogonal to Deployment Mode. Deployment Mode describes host
capabilities (GSD, Matt Skills, both, or Standalone). Depth Mode describes the
required epistemic completeness. A host MAY run any depth mode.

## Fast

Fast mode MUST capture the required behavior, active invariant, one Candidate
Mechanism, one falsification condition, and the smallest suitable Evidence
Request. It MAY run inline with one agent. It MUST still enforce schema,
provenance, and hard safety gates.

## Standard

Standard mode MUST complete the full operation artifact, inspect dependencies,
and compare at least three structurally distinct Candidate Mechanisms when an
active `CTR-*` exists. It MUST run the relevant Adversarial Critique before a
`DEC-*` lock. Inline execution is allowed; external providers MAY supply
research, diagnosis, or tests.

## Deep

Deep mode MUST complete all Standard requirements and MUST add an independent
Adversarial Critique plus empirical spikes for decision-significant unknowns.
The host SHOULD use ephemeral role subagents in isolated worktrees. Subagents
MUST return schema-validated Epistemic Delta Envelopes. Deep mode MUST record
transition and decommissioning evidence for temporary mechanisms.

## Selection and transition

The active mode MUST be recorded in `STATE.yaml`. A mode change MUST preserve
the graph and provenance. Lowering depth MUST NOT erase unresolved unknowns,
critique records, or required evidence. Raising depth MAY add candidates,
spikes, or reviews before the next decision gate.
