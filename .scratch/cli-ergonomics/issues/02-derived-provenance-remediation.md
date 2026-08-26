# 02 - Remediation hint on INVALID_DERIVED_PROVENANCE

Type: task
Status: resolved
Blocked by: none

## What to build

When the epistemic gate rejects a DERIVED node because a transitive dependency
carries non-derived provenance (UNKNOWN / ASSUMED / PROPOSED), the diagnostic
message appends the fix path:

```
... downgrade provenance to ASSUMED/PROPOSED until <dep-id> resolves
```

An external agent hit this with FRAME(DERIVED) depends_on UNK(UNKNOWN),
worked around it via PROPOSED after a wasted guessing cycle — the semantics
of the rejection are spec-correct (nine_operations epistemic invariant:
a deduction over an UNKNOWN antecedent cannot be DERIVED); only the
remediation text changes. Gate pass/fail behavior and diagnostic shape stay
untouched.

## Acceptance criteria

- [x] Dependency-provenance case message includes the downgrade hint naming the dependency id
- [x] The no-antecedents case keeps its distinct message (nothing to wait for there)
- [x] Gate result structure and codes unchanged; tests updated

## Comments

### Implementation (2026-08-26)

- Dependency-provenance diagnostic now appends `; downgrade <node> provenance to ASSUMED/PROPOSED until <dep> resolves`. No-antecedents case unchanged.
- Tests: two new cases in `tests/gates/epistemic.test.ts` — FRAME(DERIVED) depends_on UNK(UNKNOWN) asserts the full remediation message; DERIVED with no antecedents asserts its distinct message. Gate codes and result shape untouched. epistemic + gate suites green.
