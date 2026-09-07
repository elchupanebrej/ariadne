# OBS-git-merge-installation-local: Custom merge execution requires local installation

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

Repository attributes select a named custom merge driver, while the driver command and hook integration are configured locally; cloning the repository does not by itself complete executable merge integration.

## Payload

```json
{
  "source": "Git gitattributes, config, and hook documentation via Context7"
}
```
