# 02 — Zod schemas for canonical epistemic nodes

**What to build:** TypeScript types and Zod schemas for all 12 epistemic node types (TASK, FRAME, OBS, HYP, CTR, TRF, SPACE, CAN, UNK, ASM, DEP, DYN, VAL-SELECT, EVDREQ, EVD, VAL, TRANS, DEC, STATE, HANDOFF, LEAN-TASK) enforcing strict identifier prefix patterns and payload schemas.

**Blocked by:** 01 — Project scaffold and test infrastructure

**Status:** ready-for-agent

- [ ] All node types defined with TypeScript interfaces and matching Zod schemas
- [ ] Node IDs validate against `^(TASK|FRAME|OBS|HYP|CTR|TRF|SPACE|CAN|UNK|ASM|DEP|DYN|VAL-SELECT|EVDREQ|EVD|VAL|TRANS|DEC|STATE|HANDOFF|LEAN-TASK)-[0-9A-Za-z_-]+$`
- [ ] Comprehensive test suite covers positive and negative validation for all node types
