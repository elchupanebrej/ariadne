# OBS-current-matt-bridge-ingest-only: Current Matt bridge ingests artifacts only

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-24

## Statement

The current Ariadne Matt bridge detects a fixed set of skill paths and normalizes selected Matt output files into EVD or EVDREQ nodes; it exposes no skill start, resume, cancellation, event, HITL, or host-session lifecycle API.

## Payload

```json
{
  "sources": [
    "src/adapters/matt/ingest.ts",
    "src/capabilities/provider-manager.ts",
    "src/harness/controller.ts",
    "tests/adapters/matt.test.ts"
  ],
  "invariant": "Existing direct Matt skill invocation and direct Ariadne CLI or skill use must remain valid."
}
```
