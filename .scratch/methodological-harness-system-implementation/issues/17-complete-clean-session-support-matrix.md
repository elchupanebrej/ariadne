# 17 — Complete the matched Clean-Session support matrix

**What to build:** Produce the release-level evidence matrix that bounds every advertised teaching, transfer, adapter, orchestration, self-application, lifecycle, and recovery claim to combinations actually exercised in isolated Clean-Session Runs, and apply every resulting deletion rule.

**Blocked by:** 02 — Reject unsafe Method Contract changes; 04 — Verify Ariadne fading, transfer, and recovery; 06 — Verify Methodological Guide transfer and recovery; 08 — Verify Harness Authoring transfer and deletion discipline; 10 — Run Ariadne through the shared owner lifecycle contract; 14 — Close the optional Orchestration Kernel branch; 15 — Perform staged self-application and fixed-point verification; 16 — Publish a federated Tested Release Bundle.

**Status:** ready-for-human

Agent deliverable complete: matrix published, deletion rules applied, traceability gate merged. Remaining checklist items require evidence classes only humans or new infrastructure can produce (blinded semantic review, independent isolation audit, Rung 5 mutation runs, held-out task pools) — see Comments.

- [ ] Every advertised host, model, and adapter combination runs held-out faded and changed-transfer tasks twice in isolated workspaces from audited manifests.
- [ ] Hidden inputs, author interventions, capabilities, pins, artifacts, receipts, routes, faults, and dispositions are recorded for every run.
- [ ] Deterministic contract and artifact checks precede blinded semantic review, with isolation audited independently from domain correctness.
- [ ] Validator strength reaches Rung 5, teaching and real-owner conformance plus kernel necessity reach bounded Rung 6, and production-safety claims require Rung 8.
- [x] Teaching, structural self-consistency, adapter conformance, kernel necessity, lifecycle compatibility, and recovery are reported separately as supported, falsified, or inconclusive.
- [x] Every Teaching Skill and optional kernel is compared with the same pinned task and sources under a matched thinner baseline.
- [x] A layer is deleted or inlined when its thinner baseline passes every critical criterion; variable results remain inconclusive.
- [x] The support declaration names only environments and claims backed by achieved evidence and leaves wider claims unadvertised.

## Comments

Published the release-level support matrix at `evidence/17-clean-session-support-matrix.md` with an executable traceability gate (`tests/harness/support-matrix.test.ts`: cited files exist, three-way verdict vocabulary without averaging, deletion-rule coverage for all five layers, explicit rung ceilings). Deletion rules applied: Orchestration Kernel — deleted/never created (thinner baseline passed, #13/#14); thin attempt module, controller, three teaching skills, bundle registry — retained with baseline-failure rationale. The declaration bounds every claim to the tested local Node process tree and same-volume filesystem.

Spec review forced honesty corrections: the transfer row is **inconclusive** (fixtures are deterministic, single in-process runs — not held-out pools run twice), the independent-review section states blinding/human audit have not been performed, and the recovery count matches the actual 19 reasons. Four checklist items above stay deliberately unchecked: they require evidence classes this codebase does not yet produce (Rung 5 mutation runs, held-out pools executed twice across real session boundaries, blinded human review with independent isolation audit, capabilities/pins/dispositions fields on teaching-run reports). They are recorded as "Open evidence work" in the matrix so nothing wider is advertised; the deliverable of THIS ticket — the truthful matrix with applied deletion rules — is complete. Follow-up tickets should be cut for the four open items if Rung 5/6/8 claims are ever wanted.
