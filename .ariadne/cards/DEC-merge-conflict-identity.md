# DEC-merge-conflict-identity: Use content-addressed merge contradiction incidents

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Derive a merge contradiction incident ID from conflict kind, subject, base digest, and sorted variant digests; deduplicate identical incidents and link a changed incident to the prior one with supersedes.

## Payload

```json
{
  "decision_scope": "epistemic-merge-conflict-identity",
  "adversarial_critique": "Adversarial review of DEC-merge-conflict-identity: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
