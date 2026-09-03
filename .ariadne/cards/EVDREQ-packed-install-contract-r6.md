# EVDREQ-packed-install-contract-r6: Packed install and skill portability contract

- Status: REMOVED
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-08-30

## Statement

Verify the published package and method skill from a clean directory outside the repository.

## Payload

```json
{
  "claim": "CAN-portable-minimal-release-contract",
  "claim_class": "Boundary contract",
  "minimum_rung": 6,
  "pass_condition": "A clean temporary project installs the packed artifact, type-checks a documented import, and runs the method skill example without repository-root or sibling-skill paths.",
  "fail_condition": "Installation lacks documentation, declarations, licensed metadata, supported exports, or the example reaches back into the source repository.",
  "providers": [
    "Pack-and-install contract test"
  ],
  "method": "Create an npm tarball, install it into a disposable clean project, compile a documented import, and execute the packaged skill example.",
  "environment": "Clean temporary Node project on the supported runtime",
  "cleanup": "Remove the temporary project and tarball after the receipt is captured.",
  "owner": "Ariadne maintainer"
}
```
