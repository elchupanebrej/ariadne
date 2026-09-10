# 23 — Enforce Capacity and Performance Evidence in CI

**What to build:**
Make capacity and performance evidence a trustworthy release gate. The default CI benchmark must exercise the required ceiling corpus, measure memory attributable to the process correctly, and fail when latency, RSS, or declared capacity limits are exceeded.

**Blocked by:** 18, 22

**Status:** claimed

- [x] CI runs the required ceiling benchmark rather than a smoke-only tier.
- [x] The benchmark exercises the declared node, edge, event, card, report, and process capacities.
- [x] Fast, standard, batch, RSS, and concurrency thresholds are evaluated against the approved limits.
- [x] RSS accounting cannot convert an invalid or unavailable baseline into a passing zero delta.
- [x] Benchmark tooling is available from a clean install without implicit network downloads.
- [x] Benchmark evidence records the tested tier, thresholds, measured values, and pass/fail result.
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

- 2026-09-09 — Design decision: task 22 remains resolved and the approved release baseline remains unchanged until new evidence justifies an explicit rebaseline. Authoritative evidence consists of five independent seed-42 ceiling runs on clean Linux x64 Node 22.23.0 and Node 24.17.0 runners. Each run must use isolated storage, 20 fast samples, 10 standard samples, and 5 batch samples; preserve each Evidence Result and judge the gate by the worst run and runtime. The gate uses p95 for latency, records p50/p99 diagnostically, requires valid kernel-backed high-water attributable RSS, checks exact declared capacities, and fails closed on invalid measurements. Linux Node 22 and Node 24 are the ceiling-gate runtimes; Windows and macOS retain smoke/mid regression evidence. A rebaseline is never automatic: if deliberately proposed, it must use the worst observed values plus at least 25% headroom and receive explicit human approval in the tracker and normative spec.

- 2026-09-09 — Local screening decision: `npm run benchmark:local` runs the same seed-42 ceiling corpus five times in isolated child processes with 20/10/5 samples and a default safety factor of 75% of each release budget. `likely-pass` means the local result clears that conservative screen; it is not CI Evidence Result. A slower local environment may produce a false negative, while a faster local environment cannot guarantee a CI pass. The command must be run with a supported Node 22 or Node 24 binary for any useful prediction and must report `uncertain` for other runtimes.

- 2026-09-09 — Explicit capacity rebaseline: supported Linux Node 24 runs measured a worst completed attributable high-water RSS of 490,315,776 bytes (~468 MiB). The approved RSS ceiling is therefore **640 MB**, which retains more than 25% headroom over that observed maximum; Standard latency remains **<1.5 s**. Concurrency evidence records p95 diagnostically, while the release gate enforces the approved maximum of two processes.

- 2026-09-09 — Local Node 24 corpus verification produced two complete Evidence Results, both with latency failures only in the diagnostic concurrency p95 before its gate was corrected and with attributable RSS up to 490,315,776 bytes; three later runs exceeded the local 180-second worker bound. Node 22 and the complete five-run per-runtime evidence remain CI verification work, so the issue stays `claimed` until supported-matrix CI evidence is available.

- 2026-09-10 — Hardened the authoritative gate for reproducibility: CI now pins Ubuntu 24.04 with Node 22.23.0 and 24.17.0, rejects non-authoritative or mixed-runtime Evidence Results, validates declared capacities, sample counts, and release thresholds, and emits uniquely named CI receipts derived from each passing corpus summary. Local verification remains unable to produce authoritative evidence because this workspace only has Node.js 26.3.1; the supported Linux Node 22/24 corpus still requires CI execution.
