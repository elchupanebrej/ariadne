# 35 — Missing capability: atomically correct an existing node

Status: resolved

## Observed behavior

The CLI has `node add`, `get`, `list`, and `remove`, but no update or upsert operation. A second `node add` for an active ID fails with `Node already exists`. Correcting a persisted node therefore requires `node remove` followed by `node add`.

Those commands are separate transactions. A crash, cancellation, or validation error after removal leaves the materialized node at `REMOVED`; readers can observe an empty frontier/list even though the intended correction never committed.

This is a missing capability, not a defect against issue 14, which specified only add/get/list/remove.

## Expected behavior

Provide one minimal atomic API:

```text
ariadne node update <id> [--title <title>] --payload <json>
```

The command reads the current node, keeps `id` and `type` immutable, merges the supplied correction, validates the complete node with its existing schema, and appends the replacement in one `GraphStorage.transaction()`. Failure leaves the previous materialized node unchanged.

## Minimal reproduction

In an initialized disposable workspace using the built CLI:

```bash
rtk node /path/to/ariadne/dist/cli/index.js node add ASM ASM-correct --title Original --payload '{"provenance_type":"ASSUMED","statement":"Original statement"}'
rtk node /path/to/ariadne/dist/cli/index.js node add ASM ASM-correct --title Corrected --payload '{"provenance_type":"ASSUMED","statement":"Corrected statement"}'
rtk node /path/to/ariadne/dist/cli/index.js node remove ASM-correct
rtk node /path/to/ariadne/dist/cli/index.js node list
```

The second command fails. After the required remove step, the final command prints `[]`; stopping there demonstrates the failure window.

## Likely source boundary

- `src/cli/commands/node.ts`: dispatch exposes no correction command and `addNode()` rejects an existing non-removed ID before append.
- `src/graph/storage.ts`: `transaction()` already supplies the lock, read-check-append, validation, and atomic file replacement needed by the command.
- `tests/cli/node.test.ts`: covers add/remove separately but not atomic correction or failed-update preservation.

## Acceptance checks

- [x] `node update` replaces an existing node without first appending a `REMOVED` event.
- [x] The update is validated and appended inside one storage transaction.
- [x] Invalid JSON, invalid schema data, a missing ID, or an attempted `id`/`type` change leaves graph events, materialized state, `STATE.yaml`, and `INDEX.md` unchanged.
- [x] A successful update is immediately returned by `node get` and reflected in the regenerated state/index.

## Answer

Implemented `updateNode` subcommand in `src/cli/commands/node.ts` and wired into `runNode` and `src/cli/index.ts`. The operation uses `storage.transaction()` to read existing state, reject changes to `id`/`type`, merge updates, validate with `NodeSchemas[type]`, and atomically append the updated node event.


