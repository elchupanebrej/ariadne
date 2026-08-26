# 01 - Usage errors show actual vs expected argument count

Type: task
Status: resolved
Blocked by: none

## What to build

When `ariadne edge add` or `ariadne edge remove` receives the wrong number of
positional arguments, the error states the full signature **and** the actual
vs expected count, e.g.:

```
Usage: ariadne edge add <from_id> <relation> <to_id> (got 2, expected 3)
```

so a calling agent can self-correct in one cycle instead of guessing which
argument is missing. (Triggered by an external agent's report claiming the
hint was absent; current code prints the bare signature for 0/1/2 args.)

## Acceptance criteria

- [ ] `edge add` with 0, 1, and 2 args yields the usage line including `(got N, expected 3)`
- [ ] `edge remove` behaves the same (shared parser)
- [ ] A correct 3-arg invocation is unaffected
- [ ] Tests updated through the `runCli` seam

## Comments

### Implementation (2026-08-26)

- `parseEdge` now takes the subcommand usage string; arity errors append `(got N, expected 3)`. Usage constants lost their trailing newline so the error composes cleanly; help writes add it back.
- Tests: `tests/cli/edge.test.ts` new case for `edge add` (2 args) and `edge remove` (0 args) through the `runCli` seam. Suite: edge + subcommand-help green.
