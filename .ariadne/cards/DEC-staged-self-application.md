# DEC-staged-self-application: Self-application uses a staged bootstrap

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Bootstrap methodology-authoring v0 from the current guide, use it to author harness-authoring v0, use that to specify the runtime, then run the runtime on the methodology itself and stabilize v1 only after F(M) equivalence; runtime dependencies remain acyclic.

## Payload

```json
{
  "owner": "user",
  "decision_basis": "User selected the recommended topology.",
  "invariants": [
    "recursion occurs in authoring and verification rather than live invocation",
    "each stage has a versioned input and output",
    "self-consistency does not increase empirical evidence"
  ],
  "adversarial_critique": [
    "Bootstrap assumptions can be laundered into v1 by self-application.",
    "A textual fixed point can hide semantic drift across Method Contract, skills, and runtime.",
    "The equivalence check must compare normative P/A/R/L changes and retain external user/eval evidence as a separate gate."
  ]
}
```
