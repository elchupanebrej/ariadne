# 23 — Enforce Capacity and Performance Evidence in CI

**What to build:**
Make capacity and performance evidence a trustworthy release gate. The default CI benchmark must exercise the required ceiling corpus, measure memory attributable to the process correctly, and fail when latency, RSS, or declared capacity limits are exceeded.

**Blocked by:** 18, 22

**Status:** claimed

- [ ] CI runs the required ceiling benchmark rather than a smoke-only tier.
- [ ] The benchmark exercises the declared node, edge, event, card, report, and process capacities.
- [ ] Fast, standard, batch, RSS, and concurrency thresholds are evaluated against the approved limits.
- [ ] RSS accounting cannot convert an invalid or unavailable baseline into a passing zero delta.
- [ ] Benchmark tooling is available from a clean install without implicit network downloads.
- [ ] Benchmark evidence records the tested tier, thresholds, measured values, and pass/fail result.
- [ ] The benchmark and its CI gate are reproducible on the supported Linux runtime.

## Comments

The benchmark gate implementation is present in the working change set: CI now
selects the ceiling tier explicitly, the report includes declared and observed
capacity values plus thresholds, concurrency is measured, and invalid RSS
samples fail closed. Smoke and benchmark tests pass, as do typecheck and build.

The local ceiling run was executed with Node.js 26.3.1, which is outside the
declared Node.js 22/24 engine matrix. It correctly failed the latency gate for
fast queries, full verification, migration dry-run, and concurrency while
passing the RSS gate. The ticket remains `claimed` until the ceiling evidence
passes on the supported Linux Node.js 24 runner.

- 2026-09-09 — Follow-up verification on the installed Node.js 22.23.0 and 24.17.0 runtimes: semantic and epistemic association indexes, in-memory query caching, and the already-v1 migration fast path are implemented in commits `8e11c85`, `7bd6aad`, `e1769bb`, and `a8aa35e`. A Node 24 ceiling run completed in 65.43s with exact declared capacities and all latency metrics passing, but attributable RSS was 272.46 MB against the 256 MB limit. Node 22 passed memory and migration dry-run, but a repeat run reported `open` p95 at 1043.671 ms against the 1000 ms standard budget. The ticket remains `claimed` pending reproducible supported-matrix evidence.
