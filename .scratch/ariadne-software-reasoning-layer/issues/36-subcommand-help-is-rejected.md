# 36 — Subcommand help is rejected as an unknown option

Status: resolved

## Observed behavior

Root help advertises `-h, --help`, but help is recognized only when it is the first CLI argument. Group and leaf help fail:

```text
$ ariadne node --help
Error: Unknown node command: --help

$ ariadne node add --help
Error: Unknown or incomplete option: --help
```

Both commands exit with status 1.

## Expected behavior

`-h` and `--help` work at the command level where they appear. `ariadne node --help` shows node commands; `ariadne node add --help` shows the add usage and options. Help exits 0, writes no error, and does not require or mutate an Ariadne workspace.

## Minimal reproduction

```bash
rtk node dist/cli/index.js --help
rtk node dist/cli/index.js node --help
rtk node dist/cli/index.js node add --help
```

The first command succeeds. The latter two produce the errors above.

## Likely source boundary

- `src/cli/index.ts`: `runCli()` handles help only when `args[0]` is `-h` or `--help`.
- `src/cli/commands/node.ts`: `runNode()` treats group help as a subcommand; `parseFlags()` rejects leaf help. `src/cli/commands/edge.ts` uses the same parsing pattern.
- CLI tests cover root version/help-adjacent behavior but no group or leaf help path.

## Acceptance checks

- [x] Root, group, and leaf `-h`/`--help` invocations return 0 with command-appropriate usage on stdout and empty stderr.
- [x] Help succeeds outside an initialized Ariadne workspace and creates no files.
- [x] At least `node --help`, `node add --help`, and a second command family are covered through `runCli()`; the built executable has one representative subcommand-help check.
- [x] Truly unknown options still return 1 with the existing error behavior.

## Answer

- Implemented `hasHelp` in `src/cli/workspace.ts` to scan arguments and flags without treating flag values as options.
- Added group-level and leaf-level help handling across all command handlers (`node`, `edge`, `status`, `gate`, `verify`, `invalidate`, `envelope`, `ingest`, `op`, `init`, `template`).
- Ensured all `-h`/`--help` invocations return 0 with usage written to stdout, empty stderr, and no workspace mutation or file creation.
- Preserved error exit code 1 and error messages for unknown commands/options.
- Added comprehensive unit, integration, and built binary tests in `tests/cli/subcommand-help.test.ts`.
