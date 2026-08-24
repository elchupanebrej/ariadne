# OBS-ariadne-cli-build-wsl1: Ariadne CLI build unavailable in WSL1

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-24

## Statement

Running rtk npm run build on 2026-08-22 failed because the Windows npm shim reports WSL 1 is unsupported and cannot determine the Node.js install directory; /usr/bin/node v18.19.1 and the existing dist tree remain readable.

## Payload

```json
{
  "command": "rtk npm run build",
  "error": "WSL 1 is not supported; Could not determine Node.js install directory",
  "workaround": "Use the existing compiled CLI when compatible; otherwise append through the validated graph event format and run repository gates when a supported Node environment is available.",
  "impact": "Blocks rebuilding the CLI in this session; does not block local contract inspection or the self-contained prototype.",
  "component": "Ariadne CLI toolchain"
}
```
