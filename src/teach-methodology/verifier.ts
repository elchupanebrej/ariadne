import type {
  GuideProject,
  GuideVerificationResult,
  MethodDeclaredInputManifest,
} from "./types.js";

const VALID_GUIDE_ANCHORS = new Set([
  "#preface",
  "#core-concepts",
  "#how-to-read",
  "#part-i",
  "#quick-path",
  "#working-card",
  "#first-cycle",
  "#part-ii",
  "#problem",
  "#sources-review",
  "#epistemology",
  "#part-iii",
  "#basis",
  "#full-cycle",
  "#expansion-guide",
  "#part-artifacts",
  "#a1",
  "#a2",
  "#a3",
  "#a4",
  "#a5",
  "#a6",
  "#a7",
  "#part-learning",
  "#chapter-14",
  "#chapter-15",
  "#chapter-16",
  "#part-reflexive",
  "#fixed-point",
  "#conclusion",
]);

export function createDefaultDeclaredManifest(): MethodDeclaredInputManifest {
  return {
    taskId: "dependency-review-guide-authoring",
    taskDescription:
      "Author an evidence-focused guide for a first-time repository maintainer reviewing a dependency-change pull request.",
    declaredInputs: [
      {
        id: "dependency-review-task",
        role: "specification",
        source: "ticket-05-guide-authoring",
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
        id: "target-profile-selection",
        role: "profile-selector",
        source: "evidence_focused",
      },
    ],
  };
}

export function createDefaultGuideProject(): GuideProject {
  return {
    format: "methodological-guide-project/1",
    id: "dependency-change-review-guide",
    version: "1.0.0",
    status: "active",
    contract_pin: {
      id: "methodological-guide-authoring",
      version: "1.0.0-draft",
      digest: "sha256:methodological-guide-authoring-v1",
      profile: "evidence_focused",
    },
    guide_pin: {
      href: "docs/designing_methodological_guides.md",
      digest: "sha256:designing-methodological-guides-v1",
    },
    artifacts: {
      A0: {
        user_and_situation:
          "A first-time maintainer reviews a direct dependency change with repository commands available but without authority to waive security or license policy.",
        action:
          "Inspect manifest and lockfile delta, run declared checks, check policy evidence, choose approve, request_changes, or escalate, and emit a review record containing inputs, receipts, rationale, and owner.",
        learning_path:
          "Review one complete synthetic change, explain its branches, complete a partially supplied second review, decide a third independently, then handle an unknown-license case.",
        verification:
          "A domain expert checks rule correctness; a representative novice reviews a changed fixture without oral help; a repository pilot records errors, recovery, decision, and duration.",
        rationale_and_unknowns:
          "Local repository evidence supports only the pinned environment; security and license policy retain their owners; transitive behavior outside the fixture remains unknown.",
        next_step:
          "Expand all A1–A7 because this organization-normative scenario contains purpose sprawl, heterogeneous rationales, split authority, branches and escalation, transfer learning, repeatable verification, and versioned ownership.",
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
          "Dependency reviews are inconsistent and often omit a reproducible decision basis.",
        desired_outcome:
          "A novice independently produces the correct disposition and a traceable review record.",
        scope:
          "Direct dependency pull requests in the pinned repository; not emergency response, ecosystem-wide safety, or authority to waive policy.",
        priority_failure:
          "Prevent an unsafe approval; uncertainty must stop or escalate rather than be hidden.",
        success_criteria:
          "All mandatory evidence is present, the disposition matches the fixture oracle, critical errors are recovered, and no policy-owner decision is synthesized.",
        assumptions:
          "Declared repository commands and policy sources are available; unavailable or stale sources are explicit stop conditions.",
      },
      A2: {
        claims: [
          {
            id: "CLAIM-verify-repository",
            claim:
              "Declared build and test receipts are required before approval.",
            k_level: "K5",
            e_class: "E6",
            rationale_to_recommendation:
              "Pinned repository commands provide contextual compatibility evidence, so missing or failing receipts block approval.",
            countercondition:
              "Scripts, runtime, or supported-platform matrix changes.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "repository verification policy",
            confidence: "high",
          },
          {
            id: "CLAIM-advisory-check",
            claim:
              "A matching or unavailable advisory result requires security-owner review.",
            k_level: "K4",
            e_class: "E5",
            rationale_to_recommendation:
              "The security policy assigns waiver authority outside the novice role, so the reviewer escalates instead of inferring safety.",
            countercondition:
              "Policy/feed owner, format, or availability changes.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "security vulnerability management policy",
            confidence: "high",
          },
          {
            id: "CLAIM-license-boundary",
            claim:
              "An unknown or denied license requires legal-owner review.",
            k_level: "K6",
            e_class: "E5",
            rationale_to_recommendation:
              "The license policy defines acceptability and authority, so the reviewer records evidence and escalates.",
            countercondition: "Allow-list or ownership changes.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "open source compliance policy",
            confidence: "high",
          },
        ],
      },
      A3: {
        roles: {
          novice_reviewer: {
            id: "novice_reviewer",
            role: "Novice Dependency Reviewer",
            authority: ["gather_inputs", "run_checks", "record_disposition"],
            responsibilities: [
              "Inspect diff",
              "Execute verification commands",
              "Record decision",
            ],
          },
          maintainer: {
            id: "maintainer",
            role: "Repository Maintainer",
            authority: ["accept_pr", "request_changes", "manage_ci"],
            responsibilities: [
              "Reviewer guidance",
              "Repository compatibility acceptance",
            ],
          },
          security_owner: {
            id: "security_owner",
            role: "Security Policy Owner",
            authority: ["waive_security_advisory", "update_security_feed"],
            responsibilities: ["Vulnerability risk evaluation"],
          },
          legal_owner: {
            id: "legal_owner",
            role: "Legal & Compliance Owner",
            authority: ["approve_license_exception", "update_license_allowlist"],
            responsibilities: ["License risk evaluation"],
          },
          guide_owner: {
            id: "guide_owner",
            role: "Methodological Guide Owner",
            authority: ["update_guide_normative_version", "manage_lifecycle"],
            responsibilities: ["Maintain methodology integrity and versioning"],
          },
        },
        context_notes:
          "Keyboard-usable repository workflow with copyable commands and text alternatives; one representative novice and each authority owner participate in review.",
      },
      A4: {
        rules: [
          {
            id: "RULE-review-dependency-change",
            trigger:
              "A pull request changes a dependency manifest or lockfile.",
            inputs: [
              "diff",
              "manifest",
              "lockfile",
              "declared_commands",
              "advisory_result",
              "license_result",
            ],
            action: [
              { kind: "require_artifact", artifact: "A0" },
              { kind: "require_receipt", receipt: "manifest-lockfile-check" },
              { kind: "require_receipt", receipt: "repository-test" },
            ],
            branches: [
              {
                when: "inconsistent files or failed checks",
                then: "request_changes",
              },
              {
                when: "matching or unavailable advisory",
                then: "select_rule RULE-escalate-security",
              },
              {
                when: "unknown or denied license",
                then: "select_rule RULE-escalate-license",
              },
              {
                when: "all required evidence passes",
                then: "emit_receipt approved-disposition",
              },
            ],
            output: {
              review_record:
                "disposition with pins, evidence pointers, rule ID, rationale, and owner",
            },
            recovery:
              "preserve the failed receipt, correct or rerun only the failed input/check, then reevaluate",
            escalation:
              "missing authority, source, approval, or ambiguous policy remains waiting",
            rationale_ref:
              "docs/designing_methodological_guides.md#a4",
          },
          {
            id: "RULE-escalate-security",
            trigger:
              "Matching security advisory found or advisory feed unavailable.",
            inputs: ["advisory_result"],
            action: [{ kind: "stop", reason: "escalate to security owner" }],
            branches: [
              {
                when: "security owner approves waiver",
                then: "emit_receipt security-waiver-receipt",
              },
              {
                when: "security owner rejects waiver",
                then: "stop security risk rejected",
              },
            ],
            output: { escalation_target: "security_owner" },
            recovery: "await security owner decision or update advisory feed",
            escalation: "security owner",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
          },
          {
            id: "RULE-escalate-license",
            trigger:
              "Unknown or denied open source license detected in manifest.",
            inputs: ["license_result"],
            action: [{ kind: "stop", reason: "escalate to legal owner" }],
            branches: [
              {
                when: "legal owner approves license exception",
                then: "emit_receipt legal-approval-receipt",
              },
              {
                when: "legal owner rejects license",
                then: "stop license compliance rejected",
              },
            ],
            output: { escalation_target: "legal_owner" },
            recovery: "await legal owner license classification",
            escalation: "legal owner",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
          },
        ],
      },
      A5: {
        meaningful_task:
          "Decide a synthetic direct-dependency pull request.",
        worked_example:
          "Manifest and lockfile agree, advisory and license checks pass, but the pinned repository test fails; the worked decision is request_changes, with the failing receipt and recovery request linked.",
        self_explanation:
          "Explain why repository tests are contextual rather than universal proof, why a policy branch precedes preference, and why a failing check cannot be averaged against successful checks.",
        incomplete_example:
          "Supply inputs and two receipts for a second change; withhold branch selection, rationale link, and review record.",
        independent_task:
          "Review a third changed fixture without prompts.",
        transfer_error:
          "An unknown license with passing tests must escalate to legal rather than approve or request code changes.",
      },
      A6: {
        hypotheses:
          "A representative novice can produce the correct traceable disposition without oral guidance.",
        checks: [
          "Domain-expert review of rules and rationales",
          "One novice run on the worked-class fixture",
          "One changed transfer fixture",
          "One repository pilot recording errors and recovery",
        ],
        observed_criteria:
          "Starts unaided, resolves the relevant rule, gathers required evidence, respects authority, detects the critical error, recovers, explains the inference, and transfers correctly.",
        decisions: ["retain", "revise", "expand", "narrow"],
        receipt_separation:
          "External expert/user/pilot receipts are required. No self-consistency receipt exists for this ordinary target guide.",
      },
      A7: {
        ownership:
          "Guide owner changes the normative version; security, legal, and repository owners approve their respective rule changes.",
        version: "1.0.0",
        pins: {
          contract: "methodological-guide-authoring@1.0.0-draft",
          guide: "docs/designing_methodological_guides.md",
        },
        review_triggers: [
          "Security policy or advisory source change",
          "License allowlist or legal policy change",
          "Package manager or runtime update",
          "Repository verification command changes",
          "Repeated user error or failed transfer",
          "Scope change beyond direct dependency pull requests",
        ],
        feedback_and_deviations:
          "All deviations name authority, reason, expiry, and affected version.",
        distribution_and_retirement:
          "Generated views carry the source digest; incompatible predecessors are retired or have an explicit migration rule.",
      },
    },
    traceability: [
      {
        rule_id: "RULE-review-dependency-change",
        claim_id: "CLAIM-verify-repository",
        learning_id: "MODULE-first-review",
        verification_id: "VERIFY-independent-review",
        lifecycle_version: "1.0.0",
      },
      {
        rule_id: "RULE-escalate-security",
        claim_id: "CLAIM-advisory-check",
        learning_id: "MODULE-error-case",
        verification_id: "VERIFY-transfer-review",
        lifecycle_version: "1.0.0",
      },
      {
        rule_id: "RULE-escalate-license",
        claim_id: "CLAIM-license-boundary",
        learning_id: "MODULE-transfer-case",
        verification_id: "VERIFY-pilot",
        lifecycle_version: "1.0.0",
      },
    ],
    receipts: {
      external_verification: {
        expert_review: "passed-by-domain-expert",
        novice_execution: "passed-independent-novice-run",
        repository_pilot: "passed-pilot-receipt",
      },
    },
  };
}

export function verifyGuideProject(project: unknown): GuideVerificationResult {
  const problems: string[] = [];
  const diagnostics: Array<{ path: string; message: string }> = [];

  if (!project || typeof project !== "object") {
    return {
      valid: false,
      problems: ["Guide project must be a non-null object"],
    };
  }

  const p = project as Partial<GuideProject>;

  if (p.format !== "methodological-guide-project/1") {
    problems.push("Invalid format: expected methodological-guide-project/1");
    diagnostics.push({
      path: "format",
      message: "Format must be methodological-guide-project/1",
    });
  }

  if (!p.id || typeof p.id !== "string") {
    problems.push("Missing or invalid project id");
  }

  if (!p.contract_pin || typeof p.contract_pin !== "object") {
    problems.push("Missing contract_pin object");
  } else {
    if (!p.contract_pin.version || !p.contract_pin.digest) {
      problems.push("contract_pin must specify version and digest");
    }
    if (p.contract_pin.profile !== "evidence_focused") {
      problems.push("Expected evidence_focused completion profile");
    }
  }

  if (!p.guide_pin || typeof p.guide_pin !== "object" || !p.guide_pin.href) {
    problems.push("Missing or invalid guide_pin");
  }

  if (!p.artifacts || typeof p.artifacts !== "object") {
    problems.push("Missing artifacts map");
    return { valid: false, problems, diagnostics };
  }

  const arts = p.artifacts;

  // Verify A0
  if (!arts.A0) {
    problems.push("Missing required artifact A0");
  } else {
    const requiredA0Fields: Array<keyof typeof arts.A0> = [
      "user_and_situation",
      "action",
      "learning_path",
      "verification",
      "rationale_and_unknowns",
      "next_step",
    ];
    for (const field of requiredA0Fields) {
      if (!arts.A0[field] || typeof arts.A0[field] !== "string") {
        problems.push(`A0 missing required field: ${field}`);
      }
    }
  }

  // Verify A1
  if (!arts.A1) {
    problems.push("Missing required artifact A1");
  } else {
    if (!arts.A1.problem || !arts.A1.desired_outcome || !arts.A1.scope) {
      problems.push("A1 missing required profile fields");
    }
  }

  // Verify A2
  if (!arts.A2 || !Array.isArray(arts.A2.claims)) {
    problems.push("Missing required artifact A2 claims list");
  } else {
    if (arts.A2.claims.length < 3) {
      problems.push("A2 must define at least 3 rationale claims");
    }
    for (const claim of arts.A2.claims) {
      if (!claim.id || !claim.claim || !claim.rationale_to_recommendation) {
        problems.push(`A2 claim ${claim.id || "unknown"} is incomplete`);
      }
      if (
        claim.rationale_to_recommendation &&
        claim.rationale_to_recommendation.length < 20
      ) {
        problems.push(
          `A2 claim ${claim.id} rationale_to_recommendation must be a substantive inference, not a bare citation`,
        );
      }
      if (!claim.rationale_ref) {
        problems.push(`A2 claim ${claim.id} missing rationale_ref`);
      } else {
        const hashIdx = claim.rationale_ref.indexOf("#");
        if (hashIdx !== -1) {
          const anchor = claim.rationale_ref.slice(hashIdx);
          if (!VALID_GUIDE_ANCHORS.has(anchor)) {
            problems.push(
              `A2 claim ${claim.id} references non-existent guide anchor: ${anchor}`,
            );
          }
        }
      }
    }
  }

  // Verify A3
  if (!arts.A3 || !arts.A3.roles) {
    problems.push("Missing required artifact A3 user map");
  } else {
    const roles = arts.A3.roles;
    if (!roles.novice_reviewer || !roles.security_owner || !roles.legal_owner) {
      problems.push(
        "A3 must define novice_reviewer, security_owner, and legal_owner roles",
      );
    }
    if (
      roles.novice_reviewer &&
      roles.novice_reviewer.authority &&
      roles.novice_reviewer.authority.includes("waive_policy")
    ) {
      problems.push(
        "Novice reviewer must not have synthesized authority to waive policy",
      );
    }
  }

  // Verify A4
  if (!arts.A4 || !Array.isArray(arts.A4.rules)) {
    problems.push("Missing required artifact A4 decision map");
  } else {
    if (arts.A4.rules.length < 3) {
      problems.push("A4 must define at least 3 rules");
    }
    const reviewRule = arts.A4.rules.find(
      (r) => r.id === "RULE-review-dependency-change",
    );
    if (!reviewRule) {
      problems.push("A4 missing RULE-review-dependency-change");
    } else {
      if (!reviewRule.branches || reviewRule.branches.length < 4) {
        problems.push(
          "RULE-review-dependency-change must have at least 4 branches (changes requested, security escalation, license escalation, approve)",
        );
      }
      if (!reviewRule.recovery || !reviewRule.escalation) {
        problems.push(
          "RULE-review-dependency-change must define executable recovery and escalation fields",
        );
      }
    }
  }

  // Verify A5
  if (!arts.A5) {
    problems.push("Missing required artifact A5 learning module");
  } else {
    if (
      !arts.A5.meaningful_task ||
      !arts.A5.worked_example ||
      !arts.A5.self_explanation
    ) {
      problems.push("A5 missing required learning module fields");
    }
  }

  // Verify A6
  if (!arts.A6) {
    problems.push("Missing required artifact A6 verification protocol");
  } else {
    if (!arts.A6.hypotheses || !arts.A6.checks || !arts.A6.receipt_separation) {
      problems.push("A6 missing verification protocol fields");
    }
  }

  // Verify A7
  if (!arts.A7) {
    problems.push("Missing required artifact A7 lifecycle log");
  } else {
    if (
      !arts.A7.ownership ||
      !arts.A7.version ||
      !arts.A7.review_triggers ||
      !arts.A7.distribution_and_retirement
    ) {
      problems.push("A7 missing lifecycle log fields");
    }
  }

  // Verify Traceability
  if (!p.traceability || !Array.isArray(p.traceability)) {
    problems.push("Missing traceability matrix");
  } else {
    if (p.traceability.length < 3) {
      problems.push("Traceability matrix must have at least 3 rows");
    }
    for (const row of p.traceability) {
      if (
        !row.rule_id ||
        !row.claim_id ||
        !row.learning_id ||
        !row.verification_id ||
        !row.lifecycle_version
      ) {
        problems.push("Traceability row missing required link fields");
      }
    }
  }

  // Verify Receipts separation
  if (p.contract_pin?.profile === "evidence_focused") {
    if (
      !p.receipts ||
      typeof p.receipts !== "object" ||
      !p.receipts.external_verification
    ) {
      problems.push(
        "evidence_focused profile requires external_verification receipt",
      );
    }
  }

  return {
    valid: problems.length === 0,
    problems,
    diagnostics,
  };
}
