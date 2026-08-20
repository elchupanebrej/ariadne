# 10-Rung Evidentiary Ladder

## Ladder

An Evidence Request (`EVDREQ-*`) MUST name its claim class and minimum rung.
An Evidence Result (`EVD-*`) MUST name the executed method, rung, result, and
reproducible environment. A gate MUST reject a result below the requested rung.

| Rung | Method | Minimum record |
| --- | --- | --- |
| Rung 1: Static Plausibility | Design or code inspection | Explicit assumptions and a falsification condition |
| Rung 2: Compilation & Static Types | Compiler, type checker, or linter | Command and clean diagnostic result |
| Rung 3: Example-Based Unit Tests | Deterministic examples | Test command and pass/fail result |
| Rung 4: Property-Based Tests | Generated invariant checks | Generator, property, and seed or run receipt |
| Rung 5: Mutation Testing | Mutant-killing test run | Mutation Score Indicator (`MSI >= 85%`) |
| Rung 6: Integration & Contract Tests | Real boundary or contract test | Boundary, fixtures, and compatibility result |
| Rung 7: Load & Benchmark Testing | Controlled workload and p95/p99 metrics | Workload, capacity, tail latency, and environment |
| Rung 8: Fault Injection & Chaos Testing | Failure, partition, or recovery injection | Fault, scope, recovery, and invariant result |
| Rung 9: Canary & Dark Launching | Shadow traffic or staged exposure | Comparison, rollback trigger, and live receipt |
| Rung 10: Production Observability & Telemetry | Sustained production evidence | SLI, error budget, period, and telemetry source |

## Claim-class gate

| Claim class | Minimum rung | Suitable evidence | Insufficient evidence |
| --- | --- | --- | --- |
| Syntactic structure | Rung 2 | Compiler, type checker, linter | Narrative assertion |
| Algorithmic logic | Rung 3–4 | Unit or property-based tests | Happy-path manual run |
| Test suite quality | Rung 5 | Mutation testing with `MSI >= 85%` | Line coverage alone |
| Boundary contract | Rung 6 | Integration or contract test | Mocked in-memory unit test |
| Throughput & Latency | Rung 7 | Synthetic load benchmark with p99 | Unit test duration |
| Distributed safety | Rung 8 | Fault injection or partition test | Local sequential test |
| Migration safety | Rung 9 | Shadow traffic or dark launch | Staging smoke test |
| Sustained reliability | Rung 10 | SLI telemetry and error budget | One synthetic test run |

Unit tests MUST NOT verify Throughput & Latency, Distributed safety, or
consensus claims. A benchmark MUST NOT prove Distributed safety. A staging
smoke test MUST NOT prove Migration safety.

## Evidence lifecycle

1. The operation creates an `EVDREQ-*` linked to the target claim.
2. A provider executes the request and emits one `EVD-*` receipt.
3. The receipt records a verdict: `SUPPORTED`, `FALSIFIED`, or `INCONCLUSIVE`.
4. The Claim-Class Compatibility Gate compares the actual rung to the minimum.
5. A supported result may raise provenance only to the evidence it proves.
6. A falsifying result starts Transitive Invalidation.

The evidence record MUST include the test command or source, stdout digest or
telemetry reference, raw metrics where relevant, and the environment needed to
reproduce the result. Narrative confidence MUST NOT replace an Evidence Result.
