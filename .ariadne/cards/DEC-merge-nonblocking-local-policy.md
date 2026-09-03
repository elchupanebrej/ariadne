# DEC-merge-nonblocking-local-policy: Keep valid local divergence non-blocking

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Every valid DIVERGED result permits local merge and commit; the first release has no strict blocking hook, and repositories that require convergence use an explicit CI check.

## Payload

```json
{
  "decision_scope": "epistemic-merge-blocking-policy"
}
```
