# 25 — Close Verification Gaps and Curate the Production Change Set

**What to build:**
Produce a commit-ready production-hardening change set with no unexplained verification failures and no accidental generated artifacts. Reconcile tests with the approved contracts, remove or explicitly classify temporary benchmark and rendering outputs, and record the final verification evidence.

**Blocked by:** 19, 20, 24

**Status:** ready-for-agent

- [ ] Typecheck, build, unit tests, scenario tests, package smokes, and release-preflight checks pass together.
- [ ] Existing exit-status assertions and timeout failures are either fixed or replaced by tests for the approved behavior.
- [ ] Recovery, migration, benchmark, packaging, and clean-consumer evidence is retained in the agreed format.
- [ ] Temporary probes, rendered documents, large generated outputs, and local-only artifacts are excluded or explicitly justified.
- [ ] The worktree contains only intentional source, documentation, test, configuration, and approved evidence changes.
- [ ] A final status report maps every production-readiness acceptance criterion to passing evidence.
