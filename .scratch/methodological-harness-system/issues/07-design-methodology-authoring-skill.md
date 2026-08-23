# Design the Methodology Authoring Teaching Skill

Type: prototype
Status: resolved
Blocked by: 04, 05
Parent: [Methodological Harness System](../map.md)

## Question

What agent-facing teaching path, complete example with A0 and A1–A7 artifacts, recovery guidance, and verification contract let a fresh session author a methodological guide from the compact Method Contract while preserving rationale traceability and self-application?

## Comments

- [Throwaway methodology-authoring teaching-flow prototype](../prototypes/07-methodology-authoring-teaching-flow.throwaway.html) accepts the contract-pinned path with targeted recovery and rejects an unrepaired rationale link, shadow contract, pin drift, and circular proof.

## Answer

Use a **thin task-first, contract-pinned vertical slice**. The teaching skill owns lesson order, example inputs and solution, prompts, recovery practice, fading, transfer, and completion guidance only. The pinned Method Contract owns normative schemas, rules, effects, completion profiles, hooks, and lifecycle metadata; the long guide owns definitions, rationale, evidence synthesis, and provenance; the Orchestration Harness owns generic pins, gates, stops, and owner-receipt pointers.

The lesson cites Method Contract IDs and live guide anchors. It never copies normative contract fields or rationale prose into a second teaching-time source of truth.

### Minimum entry path

1. Present a meaningful guide-authoring task before introducing `A0` or `A1–A7`.
2. Load `bootstrap.lock`; resolve and validate the exact `G_n` and `M_n` versions and byte digests.
3. Select the smallest Method Contract completion profile justified by the target. The worked example uses `evidence-focused`.
4. Draft schema-valid `A0`, marking material statements `known`, `assumed`, or `unknown`.
5. Evaluate contract expansion signals. Expand one specialized artifact only when its signal appears; record the reason in `A0` and leave a concise pointer there.
6. For every material rule, resolve `rationale_ref` to the pinned guide and record the case-specific rationale-to-recommendation inference in `A2`.
7. Run artifact, obligation, traceability, completion-profile, pin, owner-receipt, and no-circular-validation checks.
8. Practice one targeted recovery, answer self-explanation prompts, complete one faded case, and route one changed metamethodological transfer case.

Stop on an unsupported format or schema dialect, pin mismatch, malformed artifact, ambiguous effect, unresolved rationale/human/approval/owner/receipt obligation, circular proof, normative self-application delta, assessor disagreement, or copied normative content.

### Complete worked example

**Task:** author an evidence-focused guide for a first-time repository maintainer who must approve, request changes on, or escalate a dependency-change pull request and leave a verifiable review record.

#### A0 — Guide Working Map

- **User and situation:** a first-time maintainer reviews a direct dependency change with repository commands available but without authority to waive security or license policy.
- **Action:** inspect the manifest and lockfile delta, run the declared verification, check policy evidence, choose `approve`, `request_changes`, or `escalate`, and emit a review record containing inputs, receipts, rationale, and owner.
- **Learning:** review one complete synthetic change, explain its branches, complete a partially supplied second review, decide a third independently, then handle an unknown-license case.
- **Verification:** a domain expert checks rule correctness; a representative novice reviews a changed fixture without oral help; a repository pilot records errors, recovery, decision, and duration.
- **Rationale and unknowns:** local repository evidence supports only the pinned environment; security and license policy retain their owners; transitive behavior outside the fixture remains unknown.
- **Next step:** expand all `A1–A7` because this organization-normative scenario contains purpose sprawl, heterogeneous rationales, split authority, branches and escalation, transfer learning, repeatable verification, and versioned ownership.

#### A1 — Methodology Profile

- **Problem:** dependency reviews are inconsistent and often omit a reproducible decision basis.
- **Outcome/capability:** a novice independently produces the correct disposition and a traceable review record.
- **Scope:** direct dependency pull requests in the pinned repository; not emergency response, ecosystem-wide safety, or authority to waive policy.
- **Priority/primary failure:** prevent an unsafe approval; uncertainty must stop or escalate rather than be hidden.
- **Success:** all mandatory evidence is present, the disposition matches the fixture oracle, critical errors are recovered, and no policy-owner decision is synthesized.
- **Assumptions:** declared repository commands and policy sources are available; unavailable or stale sources are explicit stop conditions.

#### A2 — Rationale Register

| Claim | K/E | Rationale → recommendation | Countercondition / review trigger |
|---|---|---|---|
| `CLAIM-verify-repository`: declared build and test receipts are required before approval | `K5/E6` | pinned repository commands provide contextual compatibility evidence, so missing or failing receipts block approval | scripts, runtime, or supported-platform matrix changes |
| `CLAIM-advisory-check`: a matching or unavailable advisory result requires security-owner review | `K4/E5` | the security policy assigns waiver authority outside the novice role, so the reviewer escalates instead of inferring safety | policy/feed owner, format, or availability changes |
| `CLAIM-license-boundary`: an unknown or denied license requires legal-owner review | `K6/E5` | the license policy defines acceptability and authority, so the reviewer records evidence and escalates | allow-list or ownership changes |

Each record also carries provenance, source relevance, confidence, normative assumptions, and a resolvable `rationale_ref`; none treats a citation alone as the inference.

#### A3 — User Map

- **Novice reviewer:** gathers inputs, runs checks, and records a disposition; cannot waive policy.
- **Maintainer:** owns repository acceptance and recovery from repository-check failures.
- **Security owner / legal owner:** decide advisory and license exceptions respectively.
- **Guide owner:** owns the normative guide version and change decisions.
- **Context:** keyboard-usable repository workflow with copyable commands and text alternatives; one representative novice and each authority owner participate in review.

#### A4 — Decision Map

```text
RULE-review-dependency-change
trigger: a pull request changes a dependency manifest or lockfile
inputs: diff, manifest, lockfile, declared commands, advisory result, license result
action: identify owner and intent -> compare manifest/lockfile -> run declared checks
        -> inspect advisory/license evidence -> choose and record disposition
branches:
  inconsistent files or failed checks -> request_changes
  matching/unavailable advisory -> escalate(security)
  unknown/denied license -> escalate(legal)
  all required evidence passes -> approve
output: review record with pins, evidence pointers, rule ID, rationale, disposition, owner
recovery: preserve the failed receipt, correct or rerun only the failed input/check, then reevaluate
escalation: missing authority, source, approval, or ambiguous policy remains waiting
rationale_ref: pinned guide action/recovery anchor plus the linked A2 claim
```

#### A5 — Learning Module

- **Meaningful task:** decide a synthetic direct-dependency pull request.
- **Complete example:** manifest and lockfile agree, advisory and license checks pass, but the pinned repository test fails; the worked decision is `request_changes`, with the failing receipt and recovery request linked.
- **Why/self-explanation:** explain why repository tests are contextual rather than universal proof, why a policy branch precedes preference, and why a failing check cannot be averaged against successful checks.
- **Incomplete example:** supply inputs and two receipts for a second change; withhold branch selection, rationale link, and review record.
- **Independent task:** review a third changed fixture without prompts.
- **Transfer/error:** an unknown license with passing tests must escalate to legal rather than approve or request code changes.

#### A6 — Verification Protocol

- **Hypothesis:** a representative novice can produce the correct traceable disposition without oral guidance.
- **Checks:** domain-expert review of rules and rationales; one novice run on the worked-class fixture; one changed transfer fixture; one repository pilot.
- **Observed criteria:** starts unaided, resolves the relevant rule, gathers required evidence, respects authority, detects the critical error, recovers, explains the inference, and transfers correctly.
- **Decision:** `retain`, `revise`, `expand`, or `narrow`; missing owner receipts remain incomplete.
- **Separation:** external expert/user/pilot receipts are required. No self-consistency receipt exists for this ordinary target guide.

#### A7 — Lifecycle Log

- **Owner/rights:** guide owner changes the normative version; security, legal, and repository owners approve their respective rule changes.
- **Version/pins:** every active bundle records version, digest, predecessor, status, and effective date.
- **Review triggers:** policy, advisory source, package manager, runtime, repository commands, repeated user error, or scope changes.
- **Feedback/deviations:** all deviations name authority, reason, expiry, and affected version.
- **Distribution/retirement:** generated views carry the source digest; incompatible predecessors are retired or have an explicit migration rule.

The minimum traceability rows are:

```text
RULE-review-dependency-change -> CLAIM-verify-repository -> worked review -> VERIFY-independent-review -> version
RULE-escalate-security        -> CLAIM-advisory-check    -> error case    -> VERIFY-transfer-review    -> version
RULE-escalate-license         -> CLAIM-license-boundary  -> transfer      -> VERIFY-pilot              -> version
```

### Package shape

```text
SKILL.md
example/README.md
example/input/dependency-change.json
example/solution/guide-project.json
example/receipts/external-verification.json
example/check.mjs
```

`guide-project.json` contains separately addressable `A0` and `A1–A7`, traceability rows, completion profile, and source pins. Optional per-artifact views are generated and non-normative. Do not add a copied Method Contract, embedded long-guide rationale, template generator, course runtime, database, or dependency.

### Recovery contract

| Failure | Required response |
|---|---|
| Contract or guide pin mismatch | Stop, load the exact owner-approved pins, discard mixed derived views, and restart the attempt. |
| Artifact schema or obligation failure | Preserve the failure receipt, repair only the named artifact, and rerun `artifact.changed` plus affected completion checks. |
| Unresolved `rationale_ref` | Stop; obtain an owner-approved anchor under the same guide pin and rerun link resolution. Never substitute inferred prose. |
| Missing human, approval, or owner receipt | Remain `waiting` with a pending-action pointer; never synthesize the receipt. |
| Self-application delta or assessor disagreement | Stop for Method Contract owner review; an accepted delta starts a new immutable bootstrap round. Never loop to convergence. |
| Ambiguous effect or unsupported format | Fail closed and hand the incompatibility to the Method Contract owner. |

### Self-explanation, fading, and transfer

Require the learner to explain why every `A1–A7` expansion fired, why `A0` stays concise, why a rationale needs a case-specific inference, why self-consistency cannot satisfy external verification, and why targeted recovery reruns only affected hooks.

For the **faded case**, provide an incident-handoff guide task, its `A0`, contract pin, and expansion signals; withhold `A2`, `A4`, `A6`, `A7`, trace decisions, owner receipts, and the completion verdict.

For **transfer**, ask the learner to author a guide-authoring methodology. The correct response selects the `metamethodological` profile, two isolated immutable assessment bundles, normalized `P/A/R/L` comparison, and separate external receipts. The active teaching skill never invokes or rewrites itself.

### Runnable completion contract

```sh
node example/check.mjs
```

Completion requires matching contract/guide pins; valid `A0` and `A1–A7`; a recorded trigger for every expansion; all effects, stops, and rationale links resolved; every material rule traced through learning, external verification, and lifecycle; owner receipts present; the targeted recovery receipt preserved; self-explanations, faded case, and transfer passing; and no shadow normative source or circular proof.

### Verification and reopening

- [Throwaway methodology-authoring teaching-flow prototype](../prototypes/07-methodology-authoring-teaching-flow.throwaway.html) — five deterministic paths; SHA-256 `866e6c46e7a76f5f5fa155b6f36351a43be69f57d8c508b7789a0f2a54f5e20b`.
- [`DEC-methodology-authoring-teaching-skill-contract`](../../../.ariadne/GRAPH.jsonl) records the locked teaching contract.
- [`VAL-SELECT-methodology-authoring-teaching-skill`](../../../.ariadne/GRAPH.jsonl) records the hard-requirement filter and adversarial critique.
- [`EVD-methodology-authoring-teaching-flow-prototype-r3`](../../../.ariadne/GRAPH.jsonl) records the Rung 3 prototype receipt.
- [`OBS-methodology-authoring-post-evidence-gate`](../../../.ariadne/GRAPH.jsonl) records that task-local structural and semantic gates pass while two unrelated repository-wide epistemic diagnostics remain open.

Ticket 11 retains clean-session teaching effectiveness, independent completion, transfer, and cross-host evidence. Reopen this decision if the Method Contract cannot express a required artifact or recovery without arbitrary computation, a clean-session learner needs oral guidance, supported hosts cannot resolve source pointers, the example accepts pin drift or circular proof, or self-application introduces a runtime cycle.
