# 03 — Invalidation routing diagnostics and CLI `--by` flag unification

**What to build:**
Clear routing diagnostics in `ariadne invalidate` when invoked against UNK or DEC nodes, directing users to the appropriate closure command instead of treating the target as an unhandled type. Additionally, standardizes the CLI flag surface across all three closure commands so that `--by <node-id>` is the canonical flag across `waive`, `supersede`, and `invalidate` (retaining `--reason` as a backward-compatible alias on `invalidate` only), and synchronizes root and subcommand help output and help test suites.

**Blocked by:** 01 — Unknown waiver lifecycle and CLI (`ariadne waive <UNK> --by <DEC>`), 02 — Decision supersession lifecycle and CLI (`ariadne supersede <DEC> --by <DEC>`)

**Status:** resolved

- [x] Running `ariadne invalidate <UNK> --by <EVD>` fails with a diagnostic explicitly pointing to `ariadne waive <UNK> --by <DEC>`.
- [x] Running `ariadne invalidate <DEC> --by <EVD>` fails with a diagnostic explicitly pointing to `ariadne supersede <DEC> --by <DEC>`.
- [x] `ariadne invalidate` accepts `--by <EVD>` as the canonical explanation flag alongside the legacy `--reason <text>` alias, rejecting commands specifying both.
- [x] Root help (`ariadne --help`) lists `waive`, `supersede`, and `invalidate` with `--by` syntax.
- [x] Subcommand help for `invalidate`, `waive`, and `supersede` clearly documents `--by` usage.
- [x] Subcommand help regression tests verify exit code 0, correct usage strings, and no spurious filesystem side effects.
- [x] Invalidation behavior on ASM and HYP nodes remains completely unchanged.
