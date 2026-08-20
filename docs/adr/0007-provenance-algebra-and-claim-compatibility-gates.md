# 0007. Deterministic Provenance Algebra and Claim-Class Compatibility Gates

## Context and Decision
Ariadne must prevent model hallucination, epistemic inflation (treating assumptions as facts), and invalid verification where lightweight unit tests are falsely presented as proof for distributed concurrency, throughput, or fault-tolerance claims.

We decided to:
1. **Enforce 7-Level Provenance Lattice Algebra in Deterministic Code**:
   - Model the lattice $\mathbf{U} \sqsubset \mathbf{A} \sqsubset \mathbf{P} \sqsubset \mathbf{D} \sqsubset \mathbf{M} \sqsubset \mathbf{F} \sqsubset \mathbf{L}$ in the engine.
   - Enforce the Weakest-Precondition Rule mechanically: $\operatorname{prov}(C) = \bigsqcap_{i=1}^n \operatorname{prov}(P_i)$. Any deductive claim's provenance is automatically calculated and clamped by the meet ($\sqcap$) of its antecedents.
2. **Deterministic Claim-Class Compatibility Gates**:
   - Classify claims into explicit typed categories (`FunctionalBehavior`, `ConcurrencyInvariance`, `ThroughputCapacity`, `ResourceBound`, `FaultResilience`, `SchemaEvolution`).
   - Enforce a strict minimum Evidentiary Ladder rung mapping (e.g. Concurrency requires $\ge$ Rung 5/9, Throughput requires $\ge$ Rung 8 benchmark).
   - Reject any `EvidenceResult` that attempts to satisfy an `EvidenceRequest` below the minimum rung.

## Consequences and Trade-offs
- Prevents agents from silently asserting unverified assumptions as facts or passing verification gates with superficial test assertions.
- Requires agents to declare explicit claim types and antecedent edge bindings, adding minimal structure overhead to graph mutations in exchange for strict epistemic integrity.
