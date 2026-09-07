# DEC-RPT-06: Root-relative paths invariant for emitted artifacts

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Option b repo-wide chosen: every artifact ariadne writes or prints normalizes paths relative to the project root. Option a (new report only) rejected as leaving old absolute paths in evidence and notices.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Risk: internal fs operations stay absolute - the invariant covers only strings emitted outward, otherwise worktree resolve checks break."
}
```
