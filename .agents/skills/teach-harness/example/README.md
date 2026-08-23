# Harness Authoring Worked Example: Dependency-Review Continuation Harness

This directory contains the worked example, failure input fixture, solution bundle, and runnable verification check for designing a minimal, owner-safe orchestration harness.

## Contents

- `input/dependency-review-run.json`: Input specification and failure trace for a cross-session dependency-review run experiencing process loss.
- `solution/harness-project.json`: Complete worked `harness-project/1` solution demonstrating pinned sources, outcome requirements, ownership placement, non-compensatory filtering, triggered mechanisms, pointer contract, recovery policy, and lifecycle rules.
- `check.mjs`: Runnable validation script to verify the solution and test the 6 deterministic prototype invariant paths.

## Running Verification

```sh
node check.mjs
```
