# Ariadne Worked Example: Config-Line Parser

This worked example demonstrates how Ariadne structures a complete, evidence-backed decision:

1. **Task**: Parse `KEY=VALUE` config lines without adding unneeded external dependencies.
2. **FRAME**: `FRAME-config-line-parser` separates behavioral requirements from candidate mechanisms.
3. **SPACE & CAN**: `SPACE-config-line-parser` explores stdlib parsing, JSON format change, and environment input.
4. **VAL-SELECT**: Hard-filters JSON and environment inputs before preference comparison.
5. **EVDREQ & EVD**: Algorithmic assertions provide Rung 3 evidence.
6. **DEC**: Locks the stdlib mechanism based on the verified evidence receipt.
