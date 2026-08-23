# 17 — CLI quality gate commands (ariadne gate)

**What to build:** CLI command `ariadne gate <structural|semantic|epistemic> [--strict]` executing the deterministic quality gates and returning exit code 0 on pass or code 1 on failure.

**Blocked by:** 10 — Structural quality gate, 11 — Semantic quality gate, 12 — Epistemic quality gate and claim compatibility, 13 — CLI entrypoint and status command (ariadne status)

**Status:** resolved

- [ ] `ariadne gate <type>` runs the specified gate and outputs formatted diagnostic results
- [ ] `ariadne gate all` runs all three gates in sequence
- [ ] Exits with code 0 on clean pass and code 1 on gate violation with clear remediation hints

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: commands/gate.ts gate <type|all> with structured diagnostics, remediation hints, exit codes; cli/gate.test.ts. Full suite green (53 files / 557+ tests), typecheck clean.
