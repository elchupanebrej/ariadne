# Decide errors, diagnostics, and repair behavior

Type: grilling
Blocked by: 04, 07
Parent: [Ariadne production readiness](../map.md)

## Question

What stable error categories and diagnostics must the library and CLI expose for missing data, invalid input, corrupt committed history, recoverable partial writes, lock contention, unsupported formats, permission failures, invariant violations, partial projection failure, timeout, and explicit user-command failure? Decide exit-code policy, machine-readable output, repair guidance, redaction, and which failures must always stop rather than degrade.
