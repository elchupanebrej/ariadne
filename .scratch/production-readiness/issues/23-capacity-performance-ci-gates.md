# 23 — Enforce Capacity and Performance Evidence in CI

**What to build:**
Make capacity and performance evidence a trustworthy release gate. The default CI benchmark must exercise the required ceiling corpus, measure memory attributable to the process correctly, and fail when latency, RSS, or declared capacity limits are exceeded.

**Blocked by:** 18, 22

**Status:** ready-for-agent

- [ ] CI runs the required ceiling benchmark rather than a smoke-only tier.
- [ ] The benchmark exercises the declared node, edge, event, card, report, and process capacities.
- [ ] Fast, standard, batch, RSS, and concurrency thresholds are evaluated against the approved limits.
- [ ] RSS accounting cannot convert an invalid or unavailable baseline into a passing zero delta.
- [ ] Benchmark tooling is available from a clean install without implicit network downloads.
- [ ] Benchmark evidence records the tested tier, thresholds, measured values, and pass/fail result.
- [ ] The benchmark and its CI gate are reproducible on the supported Linux runtime.
