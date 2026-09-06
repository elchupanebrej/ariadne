# Production runtime support

Research date: 2026-09-06

## Decision

Ariadne should support the latest patched releases of the maintained Node.js LTS lines on GNU/Linux, Windows, and macOS. Today that means Node.js 22 and 24. The package should declare:

```json
"engines": {
  "node": "^22.0.0 || ^24.0.0"
}
```

This replaces the current unbounded `>=20` declaration in [package.json](../../package.json). `>=20` promises EOL Node 20, odd-numbered releases, pre-LTS Node 26, and unknown future majors. npm documents `engines` as the package's compatibility declaration and notes that it is advisory unless the installer enables `engine-strict` ([npm package.json documentation](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#engines)).

Support should move with Node's schedule: add Node 26 when it becomes LTS, currently planned for 2026-10-28, and remove Node 22 after 2027-04-30. This is a release-policy update, not an evergreen range that silently expands.

## Node.js lifecycle

| Release | State on 2026-09-06 | Maintenance starts | End of life | Decision |
| --- | --- | --- | --- | --- |
| 20 | EOL | 2024-10-22 | 2026-04-30 | Do not support |
| 22 | Maintenance LTS | 2025-10-21 | 2027-04-30 | Support |
| 24 | Active LTS | 2026-10-20 | 2028-04-30 | Support |
| 26 | Current | 2027-10-20 | 2029-04-30 | Do not promise until its planned LTS transition on 2026-10-28 |

Dates and states come from the [Node.js Release Working Group schedule](https://github.com/nodejs/Release/blob/main/schedule.json); the project explicitly warns that future dates may change. Release CI should therefore select major aliases (`22`, `24`) so it tests the latest security patch of each supported line, and the support table should be reviewed at every Node LTS transition.

The current Node distribution index also shows why npm compatibility is not the same as Node compatibility: the latest Node 22 release ships npm 10, while the latest Node 24 release ships npm 11 ([official distribution index](https://nodejs.org/dist/index.json)).

## Operating systems and architectures

Ariadne can credibly support x64 and arm64 on the three named operating-system families, subject to Node's own production platform floors:

| Family | Shared production floor for Node 22 and 24 | Architectures in scope |
| --- | --- | --- |
| GNU/Linux | kernel >= 4.18 and glibc >= 2.28 | x64, arm64 |
| Windows | Windows 10 / Server 2016 or newer for x64; Windows 10 or newer for arm64 | x64, arm64 |
| macOS | 13.5 or newer, the stricter Node 24 floor | x64, arm64 |

These limits are taken from the release-line-specific [Node 22 platform table](https://github.com/nodejs/node/blob/v22.x/BUILDING.md#platform-list) and [Node 24 platform table](https://github.com/nodejs/node/blob/v24.x/BUILDING.md#platform-list). Linux musl, Linux x86/armv7, FreeBSD, and other experimental Node targets are outside the production contract. AIX, SmartOS, ppc64le, and s390x may be supported by Node, but Ariadne should not promise them without its own runner coverage. WSL is also outside the contract because Node's platform notes do not treat it as a supported native target.

The cross-architecture claim is reasonable because the published package is ESM JavaScript with one pure-JavaScript runtime dependency, Zod; native bindings appear only in development tooling ([package.json](../../package.json), [package-lock.json](../../package-lock.json)). Operating-system behavior is the larger risk: Ariadne uses filesystem mutation and locking, atomic renames, permissions, path handling, child processes, Git hooks, and a `git` executable found on `PATH`. Production support therefore assumes a supported Node platform and Git on `PATH` for Git/worktree features.

## Package managers

Package-manager support should be finite and testable rather than open-ended:

| Manager | Supported versions | Release check |
| --- | --- | --- |
| npm | 10, 11, 12 | Bundled npm 10 on Node 22 and npm 11 on Node 24; additionally install npm 12 on the Node 24 package-smoke job |
| pnpm | 10, 11, 12 | Test the lower boundary (`pnpm@10`) and current upper major (`pnpm@latest-12`) against the packed tarball |
| Yarn | 4.14.1 through the latest Yarn 4 release | Test 4.14.1 and the current stable Yarn 4 against the packed tarball |

npm 12.0.2 requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`, so it must be tested only after `setup-node` has selected a sufficiently recent supported patch ([npm 12 package metadata](https://github.com/npm/cli/blob/v12.0.2/package.json#L265-L267)). The Node 24 major alias satisfies that condition at the research date.

pnpm's official compatibility table says pnpm 10, 11, and 12 all support Node 22 and 24. pnpm 12 is a native executable and requires Node 22.13+ only when installed through npm; the unqualified npm `latest` tag still points to pnpm 11, so CI must request `latest-12` explicitly ([pnpm installation and compatibility](https://pnpm.io/installation#compatibility)). Testing the minimum and current major is sufficient for this package because the release artifact has no install script and exposes standard package exports; add a middle-major job only after a manager-specific failure.

Yarn 4 requires Node 18 or newer ([Yarn 4 release notes](https://yarnpkg.com/blog/release/4.0)). The documented lower bound should be 4.14.1 rather than 4.14.0 because 4.14.1 fixed Node 24.15+ handling ([Yarn 4.14.1 release](https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg/cli/4.14.1)). The current stable endpoint is discoverable through `yarn set version stable`; at the research date it is 4.18.0 ([Yarn installation](https://yarnpkg.com/getting-started/install), [Yarn 4.18.0 release](https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg/cli/4.18.0)). Do not add an `engines.npm` field because it produces irrelevant warnings for pnpm and Yarn consumers; document package-manager ranges and prove them with tarball installation.

## Smallest credible blocking CI matrix

Use four jobs with explicit runner labels:

| Job | Runner / architecture | Node | Purpose |
| --- | --- | --- | --- |
| Minimum runtime | `ubuntu-24.04` / x64 | 22 | Prove the oldest supported runtime and bundled npm 10 |
| Canonical release | `ubuntu-24.04` / x64 | 24 | Full verification, build once, pack once, npm 11/12 plus pnpm/Yarn boundary smokes |
| Windows semantics | `windows-2025` / x64 | 24 | Prove native Windows paths, executables, locking, permissions, and CLI installation |
| macOS and arm64 | `macos-15` / arm64 | 24 | Prove macOS filesystem behavior and the architecture-independent package claim |

This is a pairwise covering matrix: each Node LTS line, each operating-system family, each primary architecture, and each supported package-manager boundary appears at least once. A six-job Node-by-OS cross-product costs more while adding little evidence for a package without runtime native bindings. Expand to the full cross-product only after a defect demonstrates an interaction between a Node major and a non-Linux OS.

GitHub currently provides all selected runner/architecture combinations ([GitHub-hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners#supported-runners-and-hardware-resources)). Explicit labels avoid silent migration of `*-latest`; GitHub states that those aliases move between stable images. `actions/setup-node` accepts major SemVer specifications and otherwise uses the runner architecture ([setup-node documentation](https://github.com/actions/setup-node#supported-version-syntax)).

Every job should run clean lockfile installation, typecheck, tests, and an installed CLI smoke. The canonical release job should additionally build one tarball, install that tarball in clean consumers with npm 11, npm 12, pnpm 10, pnpm 12, Yarn 4.14.1, and current stable Yarn 4, then typecheck the public import and execute the installed CLI. Reuse the same tarball for every consumer so the checks prove the exact release artifact.

The current [pack smoke script](../../scripts/pack-smoke.mjs) must be made portable before it can serve this matrix: it invokes Unix `mkdir -p`, invokes `npm` by a name that is not portable to native Windows with `shell: false`, and hard-codes the `0.1.0` tarball filename. These are release-readiness tasks, not reasons to weaken Windows support.

Node 26 can run as a non-blocking early-warning job if CI capacity is free, but it is not required to prove the current LTS-only contract. No browsers, multiple Linux distributions, musl, x86, or duplicate arm64 runners are needed until Ariadne adds a native dependency or receives a reproducible platform-specific defect.

