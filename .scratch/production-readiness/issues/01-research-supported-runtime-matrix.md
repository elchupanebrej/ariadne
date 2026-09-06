# Research the supported runtime matrix

Type: research
Status: resolved
Assignee: runtime_matrix
Research branch: research/production-runtime-matrix
Blocked by: None
Parent: [Ariadne production readiness](../map.md)

## Question

Using current primary sources, which maintained Node.js releases, operating systems, CPU architectures, npm versions, and alternative package-manager versions can Ariadne credibly support and test at release time? Record lifecycle dates, platform constraints that affect this package, and the smallest CI matrix that proves the policy without redundant jobs.

## Comments

- 2026-09-06 — Researched Node release lifecycle and per-line platform tiers, GitHub-hosted runner availability, npm 12 engine requirements, and the current pnpm/Yarn compatibility boundaries from official sources. Local package metadata and process/filesystem usage were checked to distinguish runtime constraints from development-only native dependencies.

## Answer

Support the latest patched Node 22 and 24 LTS releases, with an explicit `^22.0.0 || ^24.0.0` engine range that advances at Node LTS transitions. The production platform contract covers glibc Linux, Windows, and macOS on x64/arm64 within Node's own platform floors. Support npm 10-12, pnpm 10-12, and Yarn 4.14.1 through the current Yarn 4 release.

The smallest credible release-blocking matrix is four jobs: Linux x64 on Node 22 and 24, Windows x64 on Node 24, and macOS arm64 on Node 24. Package-manager boundary checks reuse one tarball in the Linux/Node 24 job. Full evidence, citations, exclusions, and expansion triggers are in [Production runtime support](../../../docs/research/production-runtime-support.md).
