# 01 — `ariadne node add` rejects a lowercase type and does not list the valid types

**What does not work:** the `ariadne` CLI rejects a node type written in lowercase and neither the error message nor the help enumerates the valid types. Correct input has to be discovered by trial and error.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Details

- **Reproduction:** `ariadne node add frame FRAME-2026-09-03-glossary --title "..." --payload '{...}'` → `Error: Unknown node type: frame`. Retrying with uppercase `FRAME` succeeds.
- **Confirmed in code:** validation is an exact comparison against `NODE_TYPES` (src/cli/commands/node.ts:79); the dictionary of 21 types lives in src/core/types/nodes.ts:1.
- **Actual type dictionary** (corrects the original reporter's guess — `NOT` and `EXP` do not exist): TASK, FRAME, OBS, CLM, HYP, CTR, TRF, SPACE, CAN, UNK, ASM, DEP, DYN, VAL-SELECT, EVDREQ, EVD, VAL, TRANS, DEC, STATE, HANDOFF, LEAN-TASK.
- **Impact:** an agent cannot learn the valid types without grepping the sources; calls are wasted.
- **Proposed fix:** include `NODE_TYPES.join(", ")` in the `Unknown node type` error (also applies to `node list --type`) and in the `ariadne node add --help` usage string. Case-insensitivity is optional; stating the required case explicitly is sufficient.

## Acceptance criteria

- [ ] `ariadne node add <unknown-type> ...` prints the list of valid node types
- [ ] The type dictionary is visible in the help of the `node add` subcommand
- [ ] Either types are accepted case-insensitively, or the required case is explicitly stated in the error/help

## Comments

- Transferred from succubus `.scratch/ariadne-cli-defects/issues/01-node-add-ne-perechislyaet-dopustimye-tipy.md` after validation (2026-09-03): defect confirmed, the type dictionary in the original report was wrong — corrected here. Status raised to ready-for-agent.
- Fixed in commit 2c9d672: `unknownNodeType` helper built from `NODE_TYPES` used at both throw sites (`node add`, `node list --type`); type list added to `node add --help`; types remain uppercase-only, error states the required case.
