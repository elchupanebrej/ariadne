# EVDREQ-static-uncertainty-coverage: Inspect uncertainty ingress and handoff coverage

- Status: OPEN
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-09-07

## Statement

Inspect the root Ariadne skill, uncertainty rules, project specification, and downstream Matt skill contracts to determine whether general uncertainty activation and epistemic handoff are explicitly defined.

## Payload

```json
{
  "claim_class": "Syntactic structure",
  "minimum_rung": 2,
  "required_rung": 2,
  "pass_condition": "The inspected artifacts contain explicit general-uncertainty triggers and a substrate handoff contract.",
  "fail_condition": "The inspected artifacts contain only specialized triggers or prose handoff without canonical epistemic artifacts.",
  "method": "Read-only repository inspection",
  "inputs": [
    ".agents/skills/ariadne/SKILL.md",
    ".agents/skills/ariadne/rules/*.md",
    "ariadne_software_reasoning_harness_spec_v5.md",
    "grill-with-docs",
    "grilling",
    "to-spec",
    "to-tickets",
    "implement"
  ],
  "environment": "Ariadne repository at /mnt/c/Users/bulky/Projects/ariadne",
  "stopping_rule": "Stop after the root trigger, uncertainty operation, and downstream ownership contracts are compared.",
  "safety": "Read-only",
  "cleanup": "No cleanup required",
  "owner": "Ariadne root skill maintainer"
}
```
