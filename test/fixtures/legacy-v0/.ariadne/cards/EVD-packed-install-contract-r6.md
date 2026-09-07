# EVD-packed-install-contract-r6: Current packed install contract check

- Status: FALSIFIED
- Provenance: MEASURED
- Type: EVD
- Revised: 2026-08-30

## Statement

A clean consumer can install the tarball and run the packaged methodize-harness example, but the package lacks the documented typed release surface.

## Payload

```json
{
  "verdict": "FALSIFIED",
  "method": "Build tarball, install into a clean temporary consumer, inspect installed package contract, and execute packaged methodize-harness checker",
  "rung": 6,
  "receipt": "docs/research/peer-repository-harness-comparison.md",
  "environment": "Clean temporary Node consumer on Node 26.3.1, 2026-08-30",
  "claim": "EVDREQ-packed-install-contract-r6",
  "claim_class": "Boundary contract",
  "command": "npm pack; npm install ../ariadne-reasoning-0.1.0.tgz; node package-contract-assertion; node node_modules/ariadne-reasoning/.agents/skills/methodize-harness/example/check.mjs",
  "result": {
    "install": "PASS",
    "methodize_harness_example": "PASS",
    "readme": "FAIL",
    "license_file": "FAIL",
    "license_metadata": "FAIL",
    "declarations": "FAIL",
    "types_entry": "FAIL",
    "exports_map": "FAIL"
  },
  "receipt_sha256": "89fcf8d0099299d311b82f6fda388f79fe0c7a50133a6fe67c9422b7ad07e82d",
  "cleanup": "Temporary consumer and tarball removed after receipt capture.",
  "falsification_result": "The full portable release contract is absent, while the narrower packaged harness-example portability claim passed."
}
```
