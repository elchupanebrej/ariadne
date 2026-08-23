import type {
  GuideProject,
  MethodDeclaredInputManifest,
} from "./types.js";

export function createMetamethodologicalDeclaredManifest(): MethodDeclaredInputManifest {
  return {
    taskId: "metamethodological-guide-authoring",
    taskDescription:
      "Transfer the method to authoring a Methodological Guide for creating Methodological Guides without runtime recursion or self-rewriting.",
    declaredInputs: [
      {
        id: "metamethodological-task",
        role: "specification",
        source: "ticket-06-metamethodological-transfer",
      },
      {
        id: "method-contract-pinned",
        role: "method-contract",
        source: "methodological-guide-authoring@1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
      },
      {
        id: "long-guide-rationale",
        role: "rationale-and-provenance",
        source: "docs/designing_methodological_guides.md",
      },
      {
        id: "metamethodological-profile",
        role: "profile-selector",
        source: "metamethodological",
      },
    ],
  };
}

export function createMetamethodologicalGuideProject(): GuideProject {
  return {
    format: "methodological-guide-project/1",
    id: "metamethodology-authoring-guide",
    version: "1.0.0",
    status: "active",
    contract_pin: {
      id: "methodological-guide-authoring",
      version: "1.0.0-draft",
      digest: "sha256:methodological-guide-authoring-v1",
      profile: "metamethodological",
    },
    guide_pin: {
      href: "docs/designing_methodological_guides.md",
      digest: "sha256:designing-methodological-guides-v1",
    },
    acyclicity_metadata: {
      immutable_round: "round-1",
      build_time_input: true,
      self_invocation: false,
      active_rewriting: false,
    },
    artifacts: {
      A0: {
        user_and_situation:
          "A methodology engineer authors an immutable round of a Methodological Guide for authoring Methodological Guides without allowing the active builder or harness to invoke or rewrite itself.",
        action:
          "Validate pinned Method Contract, draft concise A0, expand A1–A7 on observed signals, enforce acyclicity and separate self-consistency assessments, and emit a normalized candidate.",
        learning_path:
          "Inspect metamethodological worked round, explain fixed-point equivalence, evaluate isolated candidate assessments, verify no self-invocation.",
        verification:
          "Two isolated assessments check fixed-point identity N(F_A(M_n)) = N(M_n) = N(F_B(M_n)); self-consistency receipts are separated from external verification.",
        rationale_and_unknowns:
          "Self-application proves structural fixed-point consistency only; empirical teaching effectiveness and runtime safety require separate clean-session and fault evidence.",
        next_step:
          "Expand all A1–A7 because self-application requires strict scope boundaries, formal rationale registers, clear assessor roles, fixed-point decision rules, self-consistency protocols, and immutable round lifecycle logs.",
        expansion_signals: {
          A1: "purpose_sprawl",
          A2: "heterogeneous_rationales",
          A3: "split_authority",
          A4: "branching_or_recovery",
          A5: "transfer_learning",
          A6: "repeatable_verification",
          A7: "versioned_ownership",
        },
      },
      A1: {
        problem:
          "Self-application risks circular validation where an active tool rewrites itself or misrepresents structural consistency as empirical efficacy.",
        desired_outcome:
          "A fresh session produces an acyclic, immutable Method Contract candidate with provable fixed-point identity.",
        scope:
          "Metamethodological guide authoring and contract assessment; not runtime execution of arbitrary scripts or live self-modification.",
        priority_failure:
          "Prevent runtime recursion and active rewriting; builder and harness must be build-time inputs only.",
        success_criteria:
          "Identical normalized normative projections from two independent assessors; zero self-invocation or active rewriting; distinct self-consistency receipt class.",
        assumptions:
          "Immutable bootstrap rounds are sequential and owner-gated; round delta requires owner approval before next round starts.",
      },
      A2: {
        claims: [
          {
            id: "CLAIM-acyclic-construction",
            claim:
              "Active builders and harnesses must never invoke or rewrite themselves.",
            k_level: "K5",
            e_class: "E6",
            rationale_to_recommendation:
              "Acyclic construction prevents runaway recursion and ensures deterministic replay, so runtime callbacks into active builders are prohibited.",
            countercondition:
              "Dynamic self-optimizing runtime environment.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "staged self-application specification",
            epistemic_status: "verified",
          },
          {
            id: "CLAIM-fixed-point-identity",
            claim:
              "Structural closure requires two isolated assessments to yield equal normalized normative projections.",
            k_level: "K5",
            e_class: "E6",
            rationale_to_recommendation:
              "Fixed-point identity proves structural stability without circular empirical claims, so candidate promotion requires assessor agreement.",
            countercondition:
              "Assessor divergence or non-deterministic serialization.",
            rationale_ref:
              "docs/designing_methodological_guides.md#fixed-point",
            provenance: "formal verification specification",
            epistemic_status: "verified",
          },
          {
            id: "CLAIM-receipt-independence",
            claim:
              "Self-consistency receipts cannot satisfy external verification or teaching effectiveness claims.",
            k_level: "K4",
            e_class: "E5",
            rationale_to_recommendation:
              "Self-consistency proves internal coherence but not user comprehension, so receipt classes must remain strictly isolated.",
            countercondition:
              "Universal single-claim validation policy.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "epistemic claim independence policy",
            epistemic_status: "verified",
          },
        ],
      },
      A3: {
        roles: {
          methodology_author: {
            id: "methodology_author",
            role: "Methodology Author",
            authority: ["draft_contract_candidate", "resolve_rationale_links"],
            responsibilities: ["Draft A0-A7 artifacts", "Resolve rationale references"],
          },
          isolated_assessor_a: {
            id: "isolated_assessor_a",
            role: "Isolated Assessor A",
            authority: ["evaluate_candidate_a", "emit_normalized_projection_a"],
            responsibilities: ["Independent assessment A without shared memory"],
          },
          isolated_assessor_b: {
            id: "isolated_assessor_b",
            role: "Isolated Assessor B",
            authority: ["evaluate_candidate_b", "emit_normalized_projection_b"],
            responsibilities: ["Independent assessment B without shared memory"],
          },
          contract_owner: {
            id: "contract_owner",
            role: "Method Contract Owner",
            authority: ["authorize_round_promotion", "approve_normative_delta"],
            responsibilities: ["Gate immutable bootstrap rounds and approve version bumps"],
          },
          guide_owner: {
            id: "guide_owner",
            role: "Methodological Guide Owner",
            authority: ["update_guide_normative_version", "manage_lifecycle"],
            responsibilities: ["Maintain methodology integrity and versioning"],
          },
        },
        context_notes:
          "Assessors run in isolated environments without side-channels; neither assessor can modify the active compiler or harness.",
      },
      A4: {
        rules: [
          {
            id: "RULE-assess-metamethodological-candidate",
            trigger: "An immutable bootstrap round candidate Method Contract is submitted.",
            inputs: [
              "pinned_contract_input",
              "assessor_a_projection",
              "assessor_b_projection",
              "acyclicity_attestation",
            ],
            action: [
              { kind: "require_artifact", artifact: "A0" },
              { kind: "require_receipt", receipt: "assessor-a-receipt" },
              { kind: "require_receipt", receipt: "assessor-b-receipt" },
            ],
            branches: [
              {
                when: "active rewriting or self-invocation detected",
                then: "stop fail closed: recursion detected",
              },
              {
                when: "assessors disagree or projection delta exists",
                then: "stop fail closed: fixed-point divergence",
              },
              {
                when: "all projections match and acyclicity holds",
                then: "emit_receipt self-consistency-fixed-point-receipt",
              },
            ],
            output: {
              assessment_record:
                "immutable round assessment record with fixed-point hash and assessor receipts",
            },
            recovery:
              "isolate diverging rule, start new immutable round with explicit delta; do not loop to convergence",
            escalation:
              "unresolved delta requires Method Contract owner decision",
            rationale_ref: "docs/designing_methodological_guides.md#fixed-point",
          },
          {
            id: "RULE-escalate-delta",
            trigger: "Normative delta found between candidate and active contract.",
            inputs: ["normative_delta_report"],
            action: [{ kind: "stop", reason: "escalate delta to contract owner" }],
            branches: [
              {
                when: "contract owner accepts delta",
                then: "emit_receipt start-new-round-receipt",
              },
              {
                when: "contract owner rejects delta",
                then: "stop reject candidate",
              },
            ],
            output: { escalation_target: "contract_owner" },
            recovery: "amend candidate artifacts and re-evaluate under new round",
            escalation: "contract owner",
            rationale_ref: "docs/designing_methodological_guides.md#epistemology",
          },
          {
            id: "RULE-enforce-receipt-separation",
            trigger: "Verification receipt submission for metamethodological candidate.",
            inputs: ["submitted_receipts"],
            action: [{ kind: "require_receipt", receipt: "self-consistency-receipt" }],
            branches: [
              {
                when: "self-consistency labeled as external user proof",
                then: "stop fail closed: circular proof error",
              },
              {
                when: "receipt classes properly separated",
                then: "emit_receipt receipt-separation-validated",
              },
            ],
            output: { verified_receipt_map: "separated receipt records" },
            recovery: "reclassify receipts into appropriate classes",
            escalation: "contract owner",
            rationale_ref: "docs/designing_methodological_guides.md#epistemology",
          },
        ],
      },
      A5: {
        meaningful_task:
          "Author and assess a candidate Method Contract for round N+1.",
        worked_example:
          "Candidate M_{n+1} is evaluated by Assessor A and B; projections match normalized M_n; self-consistency receipt emitted.",
        self_explanation:
          "Explain why active builders cannot invoke themselves, why self-consistency is not evidence of teaching efficacy, and why loops to convergence are prohibited.",
        incomplete_example:
          "Candidate with diverging projection from Assessor B; learner identifies divergence and halts round instead of looping.",
        independent_task:
          "Execute full metamethodological transfer for an expanded rule grammar candidate.",
        transfer_error:
          "Attempting to invoke the active harness to re-evaluate its own live code must fail closed.",
      },
      A6: {
        hypotheses:
          "Two isolated assessments of candidate Method Contract produce identical normalized normative projections without runtime self-modification.",
        checks: [
          "Acyclicity static check (no self-invocation or active rewriting)",
          "Assessor A independent projection",
          "Assessor B independent projection",
          "Fixed-point normalization equality check",
        ],
        observed_criteria:
          "No recursion, exact fixed-point match N(F_A(M_n)) = N(M_n) = N(F_B(M_n)), receipts separated.",
        decisions: ["promote_round", "reject_delta", "require_owner_review"],
        receipt_separation:
          "Self-consistency receipts (assessor A, assessor B, fixed-point) are recorded. External user receipts are separate and not satisfied by self-consistency.",
      },
      A7: {
        ownership:
          "Contract owner governs immutable rounds; guide owner governs normative documentation.",
        version: "1.0.0",
        pins: {
          contract: "methodological-guide-authoring@1.0.0-draft",
          guide: "docs/designing_methodological_guides.md",
        },
        review_triggers: [
          "Normative delta in Method Contract rules",
          "Introduction of new artifact kinds",
          "Assessor projection divergence",
          "Bootstrap round increment",
        ],
        feedback_and_deviations:
          "Deviations are prohibited during self-application; all modifications require a new immutable round.",
        distribution_and_retirement:
          "Candidate bundles are pinned by byte digest; deprecated rounds are archived with historical assessment receipts.",
        active_successor: "round-2",
        retirement_criteria: [
          "Round n+1 promoted and verified",
          "No active attempt pinned to round n",
          "Contract owner signoff",
        ],
      },
    },
    traceability: [
      {
        rule_id: "RULE-assess-metamethodological-candidate",
        claim_id: "CLAIM-fixed-point-identity",
        learning_id: "MODULE-metamethodology-worked",
        verification_id: "VERIFY-fixed-point-check",
        lifecycle_version: "1.0.0",
      },
      {
        rule_id: "RULE-escalate-delta",
        claim_id: "CLAIM-acyclic-construction",
        learning_id: "MODULE-metamethodology-transfer",
        verification_id: "VERIFY-acyclicity-check",
        lifecycle_version: "1.0.0",
      },
      {
        rule_id: "RULE-enforce-receipt-separation",
        claim_id: "CLAIM-receipt-independence",
        learning_id: "MODULE-metamethodology-pilot",
        verification_id: "VERIFY-receipt-separation",
        lifecycle_version: "1.0.0",
      },
    ],
    receipts: {
      self_consistency: {
        assessor_a_receipt: "passed-assessor-a-projection",
        assessor_b_receipt: "passed-assessor-b-projection",
        fixed_point_equality: "passed-fixed-point-equality",
      },
    },
  };
}
