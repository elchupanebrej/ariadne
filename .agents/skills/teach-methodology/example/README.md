# Dependency-Change Review Guide Example

This example demonstrates a complete, evidence-focused Methodological Guide project authored from the compact Method Contract (`method-contract/1`).

## Contents

- `input/dependency-change.json`: The declared inputs, pull request diff, manifest/lockfile context, and verification commands.
- `solution/guide-project.json`: The complete guide project containing separately addressable A0 and A1–A7 artifacts, rule records, rationale links, and traceability matrix.
- `receipts/external-verification.json`: The external verification receipts issued by domain expert, novice reviewer, and repository pilot.
- `check.mjs`: Runnable validation script that verifies the guide project against the pinned contract schemas, live rationale anchors, and completion profile.

## Verification

```sh
node check.mjs
```
