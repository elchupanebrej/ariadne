# EVD-static-uncertainty-coverage: Static inspection of uncertainty coverage

- Status: SUPPORTED
- Provenance: FACT
- Type: EVD
- Revised: 2026-09-07

## Statement

The repository defines Ariadne semantics for engineering uncertainty and decision-significant unknowns, but the current root skill routes specialized operations and lacks an explicit general-uncertainty ingress plus a cross-skill substrate contract.

## Payload

```json
{
  "verdict": "SUPPORTED",
  "method": "Read-only repository inspection",
  "methodology": "Compare root skill routing, Ariadne uncertainty rules, project specification, and Matt skill contracts.",
  "rung": 2,
  "evidentiary_rung": 2,
  "receipt": {
    "observed": [
      "Current SKILL.md description names premature mechanisms, uncertain causes, contradictions, candidate architectures, evidence, invalidation, and risky transitions but has no explicit trigger branch for general decision-significant uncertainty.",
      "rules/50-knowledge.md defines UNK and EVDREQ semantics but is only reachable after routing.",
      "grill-with-docs delegates to grilling and domain-modeling and does not define Ariadne substrate.",
      "to-spec, to-tickets, and implement are human-controlled delivery skills.",
      "Project specification states Ariadne adds reasoning semantics not first-class in GSD or Matt skills."
    ],
    "files": [
      ".agents/skills/ariadne/SKILL.md",
      ".agents/skills/ariadne/rules/50-knowledge.md",
      "ariadne_software_reasoning_harness_spec_v5.md",
      "docs/agents/issue-tracker.md"
    ]
  },
  "environment": "Ariadne repository at /mnt/c/Users/bulky/Projects/ariadne",
  "reproducible_environment": "Read files from the repository at commit/worktree state available during this run.",
  "stdout_digest": "repository-inspection-2026-08-21-uncertainty-ingress"
}
```
