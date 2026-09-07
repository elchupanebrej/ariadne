# OBS-existing-ariadne-harness-seam: Existing harness seam is Ariadne-owned

- Status: ACTIVE
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

src/harness/controller.ts is an AriadneHarnessController that selects epistemic providers, projects GSD, ingests Matt artifacts into Ariadne nodes, and persists Ariadne GraphStorage; it is not a neutral orchestration-attempt boundary.

## Payload

```json
{
  "source": "src/harness/controller.ts and tests/e2e/acceptance-scenarios.test.ts",
  "observed_by": "repository inspection",
  "invariants": [
    "Ariadne remains sole owner of epistemic graph meaning",
    "neutral attempts must not be stored as Ariadne nodes"
  ],
  "impact": "Extending this controller with neutral attempt state would merge ownership; its process and storage patterns may be reused without reusing its semantic state."
}
```
