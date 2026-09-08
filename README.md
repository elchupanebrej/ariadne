# ariadne-reasoning

Software reasoning layer and epistemic substrate for autonomous agents and
engineers. Ariadne maintains an append-only epistemic graph of propositions,
evidence, decisions, and contradictions, and projects from that graph the one
next operation worth performing — deterministically, fail-closed-first, with no
second state file to drift.

## Install

```sh
npm install ariadne-reasoning
```

The package ships prebuilt JavaScript and TypeScript declarations, with zero
install-time scripts (works under npm 12, pnpm ≥ 10, and Yarn ≥ 4.14 defaults).

## Usage

### CLI

```sh
ariadne init                          # scaffold a project graph
ariadne status                        # one next operation and frontier
ariadne report --json                 # frame report with continuation fields
ariadne gate <name>                   # run a validation gate
```

### Library

```ts
import { runCli, EpistemicGraph, EpistemicGateEngine } from "ariadne-reasoning";
```

The root entry point exposes the intentional public surface: core node and edge
schemas, the deep `EpistemicGraph` engine, `EpistemicGateEngine`, method contract
validation, and `runCli`. Internal storage drivers, adapter internals, and speculative
controllers are private implementation details.

## License

[MIT](./LICENSE)
