# 02 — Zod schemas for canonical epistemic nodes

**What to build:** TypeScript types and Zod schemas for all 12 epistemic node types (TASK, FRAME, OBS, HYP, CTR, TRF, SPACE, CAN, UNK, ASM, DEP, DYN, VAL-SELECT, EVDREQ, EVD, VAL, TRANS, DEC, STATE, HANDOFF, LEAN-TASK) enforcing strict identifier prefix patterns and payload schemas.

**Blocked by:** 01 — Project scaffold and test infrastructure

**Status:** resolved

- [ ] All node types defined with TypeScript interfaces and matching Zod schemas
- [ ] Node IDs validate against `^(TASK|FRAME|OBS|HYP|CTR|TRF|SPACE|CAN|UNK|ASM|DEP|DYN|VAL-SELECT|EVDREQ|EVD|VAL|TRANS|DEC|STATE|HANDOFF|LEAN-TASK)-[0-9A-Za-z_-]+$`
- [ ] Comprehensive test suite covers positive and negative validation for all node types

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: src/core/types/nodes.ts (22 types), NODE_ID_PATTERN in schemas/nodes.ts, tests/core/schemas/nodes.test.ts. Full suite green (53 files / 557+ tests), typecheck clean.
