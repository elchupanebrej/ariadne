import type {
  GuideProject,
  MethodDeclaredInputManifest,
} from "./types.js";

export function createIncidentHandoffDeclaredManifest(): MethodDeclaredInputManifest {
  return {
    taskId: "incident-handoff-guide-authoring",
    taskDescription:
      "Author an evidence-focused guide for an on-call engineer handing off an active production incident to the next shift on-call engineer.",
    declaredInputs: [
      {
        id: "incident-handoff-task",
        role: "specification",
        source: "ticket-06-incident-handoff",
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

export function createIncidentHandoffGuideProject(): GuideProject {
  return {
    format: "methodological-guide-project/1",
    id: "incident-shift-handoff-guide",
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
          "An on-call engineer hands off an active production incident during shift rotation without authority to alter severity or close the incident unilaterally.",
        action:
          "Synchronize incident timeline, inspect active mitigations, review open hypotheses, execute handoff checks, choose complete, pause, or escalate, and emit a signed handoff record.",
        learning_path:
          "Walkthrough one simulated latency handoff, explain branch gates, complete a partially filled cascading failure handoff, then perform an unguided multi-team handoff.",
        verification:
          "Incident commander reviews decision map; two on-call engineers run a simulated drill without intervention; a 30-day shift-rotation pilot records handoff errors and recovery.",
        rationale_and_unknowns:
          "Active observability telemetry is contextual to the incident; severity governance belongs exclusively to the incident commander; untracked downstream dependencies remain unknown.",
        next_step:
          "Expand all A1–A7 because incident handoffs involve purpose sprawl, heterogeneous rationales, split authority, branching/recovery, transfer learning, repeatable verification, and versioned ownership.",
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
          "Shift rotations during ongoing outages lose context and lead to duplicate investigation or miscommunicated mitigations.",
        desired_outcome:
          "The incoming on-call engineer independently assumes incident mitigation within 5 minutes with zero lost state.",
        scope:
          "Active production incident shift handoffs; not disaster recovery, post-mortem authoring, or executive communication.",
        priority_failure:
          "Prevent miscommunicating critical mitigation status; ambiguity must pause handoff or escalate rather than be assumed.",
        success_criteria:
          "All timeline events verified, active mitigation status confirmed, open hypotheses logged, and incident commander acknowledges receipt.",
        assumptions:
          "Incident management and observability tooling are operational; tool outages require explicit stop/escalate handling.",
      },
      A2: {
        claims: [
          {
            id: "CLAIM-timeline-sync",
            claim:
              "Declared incident timeline and telemetry receipts are required before handoff.",
            k_level: "K5",
            e_class: "E6",
            rationale_to_recommendation:
              "Verified event timeline establishes shared situational awareness, so missing or unconfirmed receipts pause handoff.",
            countercondition:
              "Telemetry feed failure or uninstrumented third-party service.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "incident response operational policy",
            epistemic_status: "verified",
          },
          {
            id: "CLAIM-severity-boundary",
            claim:
              "Severity change or incident closure requires incident commander review.",
            k_level: "K4",
            e_class: "E5",
            rationale_to_recommendation:
              "Incident governance reserves severity classification to the incident commander, so the on-call engineer escalates rather than inferring severity.",
            countercondition:
              "Emergency solo operation or off-hours single-responder protocol.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "incident governance policy",
            epistemic_status: "verified",
          },
          {
            id: "CLAIM-mitigation-verification",
            claim:
              "Unverified or failing mitigations require immediate service owner escalation.",
            k_level: "K6",
            e_class: "E5",
            rationale_to_recommendation:
              "Active mitigations must be validated by telemetry, so unconfirmed mitigations require service owner authority before proceeding.",
            countercondition:
              "Service owner unavailable or domain ownership unassigned.",
            rationale_ref:
              "docs/designing_methodological_guides.md#epistemology",
            provenance: "service reliability engineering policy",
            epistemic_status: "verified",
          },
        ],
      },
      A3: {
        roles: {
          outgoing_oncall: {
            id: "outgoing_oncall",
            role: "Outgoing On-Call Engineer",
            authority: ["gather_timeline", "summarize_mitigations", "initiate_handoff"],
            responsibilities: [
              "Compile chronological event log",
              "Document active hypotheses and failed attempts",
            ],
          },
          incoming_oncall: {
            id: "incoming_oncall",
            role: "Incoming On-Call Engineer",
            authority: ["accept_handoff", "run_diagnostics", "execute_mitigation"],
            responsibilities: [
              "Verify timeline integrity",
              "Assume pager duty and mitigation execution",
            ],
          },
          incident_commander: {
            id: "incident_commander",
            role: "Incident Commander",
            authority: ["change_severity", "close_incident", "declare_all_clear"],
            responsibilities: ["Incident response governance", "Executive communication"],
          },
          service_owner: {
            id: "service_owner",
            role: "Service Domain Owner",
            authority: ["authorize_emergency_rollback", "scale_infrastructure"],
            responsibilities: ["Domain technical decisions and rollback authority"],
          },
          guide_owner: {
            id: "guide_owner",
            role: "Methodological Guide Owner",
            authority: ["update_guide_normative_version", "manage_lifecycle"],
            responsibilities: ["Maintain methodology integrity and versioning"],
          },
        },
        context_notes:
          "Virtual war-room and command-line operational environment; incoming on-call must not synthesize commander authority.",
      },
      A4: {
        rules: [
          {
            id: "RULE-execute-incident-handoff",
            trigger: "Shift rotation occurs during an active production incident.",
            inputs: [
              "timeline_log",
              "active_mitigations",
              "open_hypotheses",
              "service_health_telemetry",
            ],
            action: [
              { kind: "require_artifact", artifact: "A0" },
              { kind: "require_receipt", receipt: "timeline-sync-check" },
              { kind: "require_receipt", receipt: "telemetry-verification-check" },
            ],
            branches: [
              {
                when: "timeline gap or unverified mitigation",
                then: "pause_handoff",
              },
              {
                when: "severity change requested",
                then: "select_rule RULE-escalate-severity",
              },
              {
                when: "emergency rollback required",
                then: "select_rule RULE-escalate-service-owner",
              },
              {
                when: "all checks and receipts verified",
                then: "emit_receipt handoff-accepted-receipt",
              },
            ],
            output: {
              handoff_record:
                "signed handoff record with timeline pins, active mitigations, and owner receipts",
            },
            recovery:
              "preserve validated timeline, re-synchronize only missing telemetry or failed receipt",
            escalation:
              "unacknowledged severity change or missing service owner authorization remains waiting",
            rationale_ref: "docs/designing_methodological_guides.md#a4",
          },
          {
            id: "RULE-escalate-severity",
            trigger: "Blast radius expands or new customer-facing impact detected.",
            inputs: ["impact_metrics"],
            action: [{ kind: "stop", reason: "escalate severity to incident commander" }],
            branches: [
              {
                when: "incident commander approves severity update",
                then: "emit_receipt severity-updated-receipt",
              },
              {
                when: "incident commander rejects severity update",
                then: "stop maintain current severity",
              },
            ],
            output: { escalation_target: "incident_commander" },
            recovery: "await commander decision or provide updated impact telemetry",
            escalation: "incident commander",
            rationale_ref: "docs/designing_methodological_guides.md#epistemology",
          },
          {
            id: "RULE-escalate-service-owner",
            trigger: "Mitigation requires emergency rollback or data correction.",
            inputs: ["rollback_plan"],
            action: [{ kind: "stop", reason: "escalate rollback authorization to service owner" }],
            branches: [
              {
                when: "service owner authorizes rollback",
                then: "emit_receipt rollback-authorized-receipt",
              },
              {
                when: "service owner denies rollback",
                then: "stop rollback rejected",
              },
            ],
            output: { escalation_target: "service_owner" },
            recovery: "await service owner approval or pursue alternate mitigation",
            escalation: "service owner",
            rationale_ref: "docs/designing_methodological_guides.md#epistemology",
          },
        ],
      },
      A5: {
        meaningful_task:
          "Perform a shift handoff for an ongoing payment API latency degradation incident.",
        worked_example:
          "Timeline shows cache eviction issue; database mitigation active; incoming on-call checks telemetry and accepts handoff with receipt.",
        self_explanation:
          "Explain why telemetry confirmation precedes handoff acceptance, why severity cannot be upgraded by on-call without commander approval, and why open hypotheses must be recorded.",
        incomplete_example:
          "Handoff missing telemetry check for active mitigation; learner identifies missing receipt and triggers pause branch.",
        independent_task:
          "Execute an unprompted shift handoff during a multi-region network partition incident.",
        transfer_error:
          "A customer impact spike must escalate to RULE-escalate-severity rather than being resolved informally during handoff.",
      },
      A6: {
        hypotheses:
          "An incoming on-call engineer can independently assume incident response without context loss or unverified assumptions.",
        checks: [
          "Incident commander review of handoff rules and authority boundaries",
          "One simulated latency handoff drill",
          "One cascading failure transfer drill",
          "One 30-day shift-rotation pilot",
        ],
        observed_criteria:
          "Timeline validated, rules executed, authority respected, critical gaps paused and recovered, decision explained.",
        decisions: ["retain", "revise", "expand", "narrow"],
        receipt_separation:
          "External commander, drill, and pilot receipts are required. Self-consistency receipts do not apply.",
      },
      A7: {
        ownership:
          "Guide owner maintains normative version; incident commanders and service reliability owners approve rule modifications.",
        version: "1.0.0",
        pins: {
          contract: "methodological-guide-authoring@1.0.0-draft",
          guide: "docs/designing_methodological_guides.md",
        },
        review_triggers: [
          "Post-incident review (PIR) action items",
          "Observability and alerting platform migrations",
          "On-call rotation schedule structure changes",
          "Recurring handoff communication failures",
          "Major incident process policy updates",
        ],
        feedback_and_deviations:
          "Deviations require incident commander written approval, rationale, and 24-hour expiration.",
        distribution_and_retirement:
          "Checklists carry source digest; retired handoff procedures archived with historical incident links.",
        active_successor: "none",
        retirement_criteria: [
          "No active on-call rotation uses this procedure",
          "New incident response toolchain deployed and verified",
          "Reliability leadership approval",
        ],
      },
    },
    traceability: [
      {
        rule_id: "RULE-execute-incident-handoff",
        claim_id: "CLAIM-timeline-sync",
        learning_id: "MODULE-incident-worked",
        verification_id: "VERIFY-handoff-drill",
        lifecycle_version: "1.0.0",
      },
      {
        rule_id: "RULE-escalate-severity",
        claim_id: "CLAIM-severity-boundary",
        learning_id: "MODULE-incident-transfer",
        verification_id: "VERIFY-commander-review",
        lifecycle_version: "1.0.0",
      },
      {
        rule_id: "RULE-escalate-service-owner",
        claim_id: "CLAIM-mitigation-verification",
        learning_id: "MODULE-incident-pilot",
        verification_id: "VERIFY-rotation-pilot",
        lifecycle_version: "1.0.0",
      },
    ],
    receipts: {
      external_verification: {
        commander_review: "passed-incident-commander-review",
        drill_execution: "passed-oncall-drill",
        rotation_pilot: "passed-30day-pilot",
      },
    },
  };
}
