# OBS-git-three-way-driver: Git merge driver owns the three-way file merge

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-30

## Statement

Git custom merge drivers receive ancestor, current/result, and incoming files, whereas pre-merge-commit runs only after a successful automatic merge.

## Payload

```json
{
  "source": "official Git gitattributes and githooks documentation"
}
```
