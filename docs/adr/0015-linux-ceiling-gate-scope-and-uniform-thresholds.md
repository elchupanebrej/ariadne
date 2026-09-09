# 0015. Linux Ceiling Gate Scope and Uniform Thresholds

The release baseline uses one set of latency and memory thresholds, but the authoritative full-capacity gate runs on Linux x64 Node 22 and Node 24. Windows and macOS continue to run smoke and mid-tier evidence with the same thresholds, while their results do not claim proof of the full capacity envelope. This preserves coverage of both declared Linux runtimes without introducing platform-specific multipliers or making the release gate depend on the cost and variability of four full ceiling workloads.

The uniform release thresholds are Fast `<100 ms`, Standard `<1.5 s`, Batch `<10 s`, attributable high-water RSS `<=640 MB`, and a maximum of two concurrent processes. The RSS and Standard thresholds were deliberately rebaselined after supported-runtime evidence observed a worst completed attributable RSS of 490,315,776 bytes; 640 MB retains more than 25% headroom. The concurrency p95 is retained as diagnostic evidence, while the release gate enforces the declared process-count limit.

## Status

Accepted

## Considered Options

- Run the full ceiling benchmark on all four matrix platforms: rejected because it expands the release gate without improving the authoritative Linux runtime decision proportionally.
- Run the ceiling benchmark only on Node 24: rejected because Node 22 is also a declared supported runtime.
- Use platform-specific thresholds: rejected because it would turn hardware variance into incompatible release contracts.

## Consequences

The CI workflow must block on either Linux ceiling runtime failing or producing invalid evidence. Non-Linux matrix jobs still provide regression evidence, but a green smoke/mid result cannot be interpreted as proof that the full ceiling envelope is supported there.
