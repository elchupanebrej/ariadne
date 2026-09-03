# EVDREQ-peer-repository-harness-patterns: Compare peer harness repositories

- Status: OPEN
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-08-30

## Statement

Inspect the current Ariadne harness and the official Matt Pocock Skills, OpenGSD, OpenSpec, and OpenCode repositories to identify discriminating missing behaviors and minimal adoption candidates.

## Payload

```json
{
  "claim": "UNK-peer-repository-harness-gaps",
  "claim_class": "Architectural boundary",
  "minimum_rung": 1,
  "pass_condition": "At least one source-backed peer behavior maps to a reproducible Ariadne gap without violating single ownership.",
  "fail_condition": "All observed peer behaviors are already present, out of scope, or violate hard Ariadne ownership constraints.",
  "providers": [
    "local repository inspection",
    "official upstream repository inspection"
  ],
  "question": "Do the named repositories demonstrate a behavior Ariadne lacks that changes cold-start, continuation, artifact validation, ownership, or verification outcomes?",
  "competing_outcomes": [
    "No discriminating gap; retain current harness",
    "A discriminating gap exists; propose the smallest mechanism that closes it"
  ],
  "method": "Read-only code and documentation comparison against current Ariadne source and tests",
  "inputs": [
    "Ariadne workspace",
    "official Matt Pocock Skills repository",
    "official OpenGSD repository",
    "official OpenSpec repository",
    "official OpenCode repository"
  ],
  "environment": "Ariadne workspace and public upstream repositories as of 2026-08-30",
  "stopping_rule": "Stop after each repository has at least one source-backed boundary pattern mapped to current Ariadne behavior and every proposed improvement has a falsification condition.",
  "safety": "Read-only upstream inspection; no external mutation",
  "cleanup": "Remove disposable clones after inspection if any are created",
  "owner": "Ariadne maintainer",
  "deadline": "2026-08-30"
}
```
