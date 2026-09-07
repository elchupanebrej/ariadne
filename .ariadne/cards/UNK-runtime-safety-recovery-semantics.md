# UNK-runtime-safety-recovery-semantics: Hard runtime safety, observability, and recovery semantics

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Which authorization evidence, replay budget, cancellation outcome, recovery record, observability envelope, and escalation disposition are mandatory at the host-neutral harness boundary, and which remain host or owner responsibilities?

## Payload

```json
{
  "owner": "user",
  "resolved_by": "DEC-runtime-safety-recovery-contract",
  "resolution": "Use trusted-host, owner-gated, pointer-only semantics: validate bound authority and external pointers; atomically record dispatch intent; default replay to zero; accept only ordered owner events and effect receipts; persist generic recovery and correlation fields; fail closed or wait on every invalid, expired, conflicting, canceled, or ambiguous boundary; leave enforcement, semantic recovery, telemetry infrastructure, escalation routing, and compensation with existing owners."
}
```
