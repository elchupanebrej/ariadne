---
name: teach-methodology
description: Teach a fresh agent to author a Methodological Guide from the pinned Method Contract.
disable-model-invocation: true
---

# Methodology Authoring Teaching Skill

Teach a fresh agent session to author a complete, traceable Methodological Guide project from the compact Method Contract without copying normative contract fields or long-guide rationale prose into the lesson.

## Learning Path

1. **Meaningful Task First**: Present the concrete guide-authoring task before introducing A0 or A1–A7 taxonomy.
2. **Pinned Method Contract**: Load `bootstrap.lock`; resolve and validate the exact `G_n` and `M_n` versions and byte digests.
3. **Profile Selection**: Select the smallest Method Contract completion profile justified by the target (`evidence_focused` for the worked example).
4. **Draft A0 (Working Map)**: Draft schema-valid A0, marking material statements `known`, `assumed`, or `unknown`.
5. **Evaluate Expansion Signals**: Evaluate contract expansion signals (`purpose_sprawl`, `heterogeneous_rationales`, `split_authority`, `branching_or_recovery`, `transfer_learning`, `repeatable_verification`, `versioned_ownership`). Expand one specialized artifact only when its signal appears; record the reason in A0 and leave a concise pointer there.
6. **Case-Specific Rationale Inferences**: For every material rule, resolve `rationale_ref` to the pinned guide and record the case-specific rationale-to-recommendation inference in A2.
7. **Executable Rule Records**: Express branching, recovery, stopping, and escalation as executable rule records in A4 rather than prose-dependent interpretations.
8. **Run Contract Gates & Traceability**: Run artifact, obligation, traceability, completion-profile, pin, owner-receipt, and no-circular-validation checks.
9. **Targeted Recovery**: Practice one targeted recovery (repairing a broken rationale link without restarting unrelated work).
10. **Self-Explanation**: Answer the why-prompts citing live sources after runnable checks pass.
11. **Faded Practice**: Complete the faded incident-handoff case with withheld trace decisions and receipts.
12. **Metamethodological Transfer**: Route the changed metamethodological transfer case using isolated immutable assessment bundles.

## Complete Worked Example: Dependency-Change Review Guide

- **Task**: Author an evidence-focused guide for a first-time repository maintainer who must approve, request changes on, or escalate a direct dependency-change pull request and leave a verifiable review record.
- **Directory**: `example/`
- **Inputs**: `example/input/dependency-change.json`
- **Solution**: `example/solution/guide-project.json`
- **Receipts**: `example/receipts/external-verification.json`
- **Verification**: `node example/check.mjs`

## Self-Explanation Prompts

After the runnable check passes, the learner must answer:

1. **Expansion Signals**: Why did each A1–A7 expansion fire instead of being created mechanically?
   - *Basis*: Cites `docs/designing_methodological_guides.md#expansion-guide`.
2. **Concise A0**: Why must A0 remain concise after specialized artifacts expand?
   - *Basis*: Cites `docs/designing_methodological_guides.md#working-card`.
3. **Rationale Inferences**: Why does a rationale citation need a case-specific inference rather than a bare citation?
   - *Basis*: Cites `docs/designing_methodological_guides.md#epistemology`.
4. **Receipt Separation**: Why can self-consistency not satisfy external user verification?
   - *Basis*: Cites `docs/designing_methodological_guides.md#fixed-point`.
5. **Targeted Recovery**: Why does targeted recovery rerun affected hooks instead of rebuilding the method?
   - *Basis*: Cites `docs/designing_methodological_guides.md#chapter-16`.

## Faded Practice Case

- **Task**: Provide an incident-handoff guide task, its A0, contract pin, and expansion signals; withhold A2, A4, A6, A7, trace decisions, owner receipts, and the completion verdict.
- **Expected Outcome**: Evidence-focused selection with correctly triggered artifacts and external verification protocol.

## Metamethodological Transfer Case

- **Task**: Author a guide-authoring methodology.
- **Expected Route**: Select `metamethodological` profile, two isolated immutable assessment bundles, normalized P/A/R/L comparison, and separate external receipts. The active teaching skill never invokes or rewrites itself.

## Runnable Completion Check

```sh
node example/check.mjs
```
