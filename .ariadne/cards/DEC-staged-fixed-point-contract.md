# DEC-staged-fixed-point-contract: Staged self-application reaches structural v1 by immutable rounds

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Use owner-gated immutable bootstrap rounds and promote a structural v1 release set only when two isolated complete self-applications over identical pins agree and preserve the normalized P/A/R/L core; any normative delta, assessor disagreement, pin drift, live dependency cycle, ambiguous classification, human stop, or invalid receipt ends the run without automatic iteration.

## Payload

```json
{
  "dependencies": [
    "DEC-staged-self-application",
    "DEC-method-contract-shape",
    "DEC-minimum-orchestration-contract",
    "EVD-staged-fixed-point-prototype"
  ],
  "owner": "user via requested Wayfinder ticket resolution",
  "candidate": "CAN-staged-snapshot-fixed-point",
  "selection": "VAL-SELECT-staged-fixed-point-contract",
  "evidence": [
    "EVD-staged-fixed-point-prototype",
    "VAL-staged-fixed-point-prototype"
  ],
  "artifact_flow": [
    "Pin the guide snapshot and draft Method Contract as bootstrap inputs.",
    "Build methodology-authoring from the pinned Method Contract.",
    "Build harness-authoring from methodology-authoring, the Method Contract, and pinned harness research.",
    "Build the Orchestration Harness from harness-authoring and owner adapter contracts.",
    "Run two isolated complete self-applications through the harness; each emits A0-A7, the 49-item audit, B1-B7 leave-one-out, change propagation, a full core candidate, normalized projection and diff, and an independence receipt.",
    "Promote one fixed round as structural v1 and repin or rebuild consumers under their declared compatibility rules."
  ],
  "equivalence": "N(Fa(Mn)) = N(Mn) = N(Fb(Mn)); N projects the Method Contract to P principles and normative A2 claims, A artifact roles and schemas, R rules/completion/hooks/lifecycle policies, and L normative references. It removes release-instance and receipt metadata, ignores object and declared-set ordering, preserves execution order, and treats schema, rule, lifecycle-policy, and normative-link changes as core changes by default.",
  "runtime_dag": "Orchestration Harness -> owner adapter -> methodology-authoring -> pinned Method Contract. Harness-authoring is a build-time input only; the Method Contract and authoring skills never invoke the active harness.",
  "stopping_rule": "Succeed only after both complete independent receipts pass and agree with the pinned input projection. Stop immediately on every other terminal condition. An agreed normative delta may begin a new immutable round only after Method Contract owner acceptance; the runtime never loops to convergence or rewrites its active inputs.",
  "external_boundary": "Structural closure and fixed-point receipts never satisfy, replace, or increase the strength of empirical verification receipts. Structural v1 records empirical status separately.",
  "version_scope": "Bootstrap round labels are provenance rather than compatibility promises. The v1 release-set label points to the fixed round; ticket 12 still owns component version relationships, compatibility, migration, and retirement policy.",
  "unresolved_risks": [
    "clean-session effectiveness remains unmeasured",
    "real adapters remain unvalidated",
    "schema equivalence is conservative and may produce safe false negatives",
    "runtime permanence remains falsifiable"
  ],
  "adversarial_critique": [
    "A conservative projection can require human review for semantically equivalent schema rewrites.",
    "Independent assessments can share assumptions despite isolated artifacts.",
    "A v0 bootstrap can preserve a complete but ineffective method.",
    "Automatic convergence would let the harness usurp normative ownership, so it is prohibited.",
    "The fixed point applies to the method core, not proof that the teaching skills, adapters, or runtime are empirically effective."
  ]
}
```
