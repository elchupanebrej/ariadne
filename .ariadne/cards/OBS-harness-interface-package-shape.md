# OBS-harness-interface-package-shape: Harness interface and package shape

- Status: ACTIVE
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

The published Ariadne package exposes a broad teaching-simulator surface while omitting basic consumer documentation and TypeScript declarations.

## Payload

```json
{
  "falsification_conditions": [
    "A published pack contains README, license, declarations, and a narrow supported export map",
    "A non-test runtime caller demonstrates that the teaching simulator is required by library execution"
  ],
  "observed_at": "2026-08-30",
  "method": "Repository call-site inspection, export scan, npm pack dry run, and byte counts",
  "commands": [
    "rg public exports and non-test call sites under src/tests/docs",
    "npm pack --dry-run --json",
    "find dist -name *.d.ts",
    "du -cb dist/teach-*/*.js"
  ],
  "observations": {
    "npm_pack_entries": 122,
    "npm_pack_unpacked_bytes": 775022,
    "compiled_teaching_bytes": 243658,
    "compiled_teaching_share": "31 percent",
    "root_readme_present": false,
    "license_present": false,
    "typescript_declarations": 0,
    "teach_harness_non_test_runtime_callers": "none beyond the root star export; references are tests and planning documents",
    "harness_attempt_role": "runtime continuation seam with process-boundary tests",
    "harness_controller_role": "CLI-used graph/provider seam"
  },
  "receipt": {
    "package": "ariadne-reasoning@0.1.0",
    "verify_command": "rtk npm run verify",
    "verify_result": "PASS"
  }
}
```
