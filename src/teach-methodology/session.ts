import type {
  A0WorkingMap,
  A1MethodologyProfile,
  A2RationaleRegister,
  A3UserMap,
  A4DecisionMap,
  A5LearningModule,
  A6VerificationProtocol,
  A7LifecycleLog,
  GuideProject,
  MethodAuthorityRepairResult,
  MethodClaimEvaluation,
  MethodClaimStatus,
  MethodDeclaredInputManifest,
  MethodologyClaimsReport,
  MethodologyRunReceipt,
  MethodologyRunReport,
  MethodPinRepairResult,
  MethodRepairResult,
  MethodTeachingFault,
  MethodTeachingFaultType,
  MethodTeachingPhase,
  MethodTeachingState,
  MethodTeachingStatus,
  PrototypeSelfCheckResult,
} from "./types.js";
import {
  createDefaultDeclaredManifest,
  createDefaultGuideProject,
  verifyGuideProject,
} from "./verifier.js";
import { createIncidentHandoffGuideProject } from "./incident-handoff.js";
import { createMetamethodologicalGuideProject } from "./metamethodology.js";

const ARTIFACT_REASONS: Record<string, string> = {
  A0: "Concise current map for the dependency-change review guide",
  A1: "The guide is organization-normative and needs explicit scope and success measures",
  A2: "Security, license, and test recommendations have different sources and epistemic basis",
  A3: "Reviewer, maintainer, security, and legal roles have different authority",
  A4: "Advisory, license, lockfile, verification, recovery, and escalation branches are observable",
  A5: "A novice must move from one worked review to independent and transfer performance",
  A6: "Expert review, target-user execution, and pilot decisions require repeatable receipts",
  A7: "Advisory changes, tool changes, ownership, versions, and retirement require lifecycle rules",
};

const RATIONALE_LINKS = [
  "A2:CLAIM-advisory-check -> docs/designing_methodological_guides.md#epistemology",
  "A2:CLAIM-license-boundary -> docs/designing_methodological_guides.md#epistemology",
  "A2:CLAIM-verify-repository -> docs/designing_methodological_guides.md#epistemology",
  "A4:RULE-review-dependency-change -> docs/designing_methodological_guides.md#a4",
  "A5:MODULE-first-review -> docs/designing_methodological_guides.md#chapter-14",
  "A6:VERIFY-independent-review -> docs/designing_methodological_guides.md#chapter-16",
];

const COMPLETE_ACTIONS = [
  "task",
  "pin",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "trace",
  "break-link",
  "repair",
  "external",
  "explain",
  "fade",
  "transfer",
];

export class MethodologyTeachingSession {
  private state: MethodTeachingState;

  constructor(initialManifest?: MethodDeclaredInputManifest) {
    this.state = this.createInitialState(initialManifest);
  }

  private createInitialState(
    manifest?: MethodDeclaredInputManifest,
  ): MethodTeachingState {
    return {
      phase: "not_started",
      status: "learning",
      currentSource: "none",
      task: false,
      contractPinned: false,
      contractPin: "none",
      completionProfile: "none",
      artifacts: {},
      links: [],
      externalReceipt: false,
      selfConsistencyReceipt: false,
      selfConsistencySeparated: false,
      selfExplanation: false,
      fadedCase: false,
      transferCase: false,
      acyclicityVerified: false,
      selfInvocationDetected: false,
      activeRewritingDetected: false,
      recoveryPracticed: false,
      brokenLink: false,
      shadowContract: false,
      circularProof: false,
      lastMessage: "No guide-authoring task has been presented.",
      manifest: manifest || createDefaultDeclaredManifest(),
      prohibitedInputsDetected: [],
      interventions: [],
      routeChoices: [
        ".agents/skills/methodize/SKILL.md",
        "docs/designing_methodological_guides.md",
      ],
      faults: [],
    };
  }

  public getState(): MethodTeachingState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public detectProhibitedInput(inputId: string): void {
    if (!this.state.prohibitedInputsDetected.includes(inputId)) {
      this.state.prohibitedInputsDetected.push(inputId);
    }
  }

  public recordIntervention(note: string): void {
    this.state.interventions.push(note);
  }

  public recordRouteChoice(route: string): void {
    if (!this.state.routeChoices.includes(route)) {
      this.state.routeChoices.push(route);
    }
  }

  public startTask(): { success: boolean; message: string } {
    this.state.task = true;
    this.state.phase = "meaningful_task";
    this.state.lastMessage =
      "Task: author an evidence-focused guide that lets a first-time reviewer approve, reject, or escalate a dependency-change pull request and leave a verifiable review record.";
    return { success: true, message: this.state.lastMessage };
  }

  public pinContract(options?: {
    version?: string;
    digest?: string;
    profile?: string;
  }): { success: boolean; message: string } {
    if (!this.state.task) {
      return {
        success: false,
        message: "Start with the guide-authoring task before loading contract.",
      };
    }
    const version = options?.version || "1.0.0-draft";
    const digest =
      options?.digest || "sha256:methodological-guide-authoring-v1";
    const profile = options?.profile || "evidence_focused";

    this.state.contractPinned = true;
    this.state.contractPin = `methodological-guide-authoring@${version} + ${digest}`;
    this.state.completionProfile = profile;
    this.state.currentSource = "pinned M_n";
    this.state.phase = "contract_loaded";
    this.state.lastMessage =
      "Validated the closed contract envelope and selected evidence_focused completion; no method rule was copied into the lesson.";
    return { success: true, message: this.state.lastMessage };
  }

  public draftA0(content?: Partial<A0WorkingMap>): {
    success: boolean;
    message: string;
  } {
    if (!this.state.task) {
      return {
        success: false,
        message: "Start with the guide-authoring task before drafting A0.",
      };
    }
    if (!this.state.contractPinned) {
      return {
        success: false,
        message: "Pin and validate the Method Contract first.",
      };
    }

    const defaultProject = createDefaultGuideProject();
    const a0 = {
      ...defaultProject.artifacts.A0,
      ...(content || {}),
    };

    this.state.artifacts.A0 = a0;
    this.state.currentSource = "M_n#artifacts.A0";
    this.state.phase = "working_map";
    this.state.lastMessage =
      "A0 now names the novice reviewer, dependency-change task, observable review record, learning path, verification, unknowns, and next expansion signal.";
    return { success: true, message: this.state.lastMessage };
  }

  public expandArtifact(
    id: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7",
  ): { success: boolean; message: string } {
    if (!this.state.artifacts.A0) {
      return {
        success: false,
        message: "Draft A0 before expanding a specialized artifact.",
      };
    }

    const defaultProject = createDefaultGuideProject();
    this.state.artifacts[id] = defaultProject.artifacts[id];
    this.state.currentSource = `M_n#artifacts.${id}`;
    this.state.phase = `expanded_${id}` as MethodTeachingPhase;
    this.state.lastMessage = `${id} added because: ${ARTIFACT_REASONS[id]}.`;
    return { success: true, message: this.state.lastMessage };
  }

  public resolveRationaleLinks(): { success: boolean; message: string } {
    const requiredArtifacts = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"];
    const allPresent = requiredArtifacts.every(
      (id) => this.state.artifacts[id] !== undefined,
    );
    if (!allPresent) {
      return {
        success: false,
        message: "Complete every triggered artifact before the traceability pass.",
      };
    }

    this.state.links = [...RATIONALE_LINKS];
    this.state.brokenLink = false;
    this.state.currentSource = "G_n rationale anchors resolved from M_n";
    this.state.phase = "traceable";
    this.state.lastMessage =
      "Resolved stable Method Contract IDs through to long-guide rationale anchors; example text remains non-normative.";
    return { success: true, message: this.state.lastMessage };
  }

  public breakRationaleLink(): { success: boolean; message: string } {
    if (this.state.links.length === 0) {
      return {
        success: false,
        message: "Resolve rationale links before practicing link failure.",
      };
    }
    this.state.links.pop();
    this.state.brokenLink = true;
    this.state.phase = "blocked";
    this.state.lastMessage =
      "The A6 verification rationale anchor no longer resolves; completion fails closed.";
    return { success: true, message: this.state.lastMessage };
  }

  public runTargetedRecovery(): { success: boolean; message: string } {
    if (!this.state.brokenLink) {
      return {
        success: false,
        message: "Targeted recovery requires an observed failed obligation.",
      };
    }
    this.state.links = [...RATIONALE_LINKS];
    this.state.brokenLink = false;
    this.state.recoveryPracticed = true;
    this.state.currentSource =
      "M_n verification hook + docs/designing_methodological_guides.md#chapter-16";
    this.state.phase = "traceable";
    this.state.lastMessage =
      "Re-resolved the owner-approved anchor under the same pins and reran only link resolution and affected completion checks.";
    return { success: true, message: this.state.lastMessage };
  }

  private previousPhase: MethodTeachingPhase = "not_started";

  public recordFault(
    type: MethodTeachingFaultType,
    details: string,
    targetId?: string,
  ): void {
    if (this.state.phase !== "blocked") {
      this.previousPhase = this.state.phase;
    }
    this.state.faults.push({
      type,
      details,
      targetId,
      timestamp: new Date().toISOString(),
      resolved: false,
    });
    if (type === "pin_failure") {
      this.state.contractPinned = false;
      this.state.contractPin = "none";
    } else if (type === "rationale_failure") {
      this.state.brokenLink = true;
    } else if (type === "circularity_failure") {
      this.state.circularProof = true;
    } else if (type === "authority_failure" && targetId) {
      const a3 = this.state.artifacts.A3 as A3UserMap | undefined;
      if (a3?.roles?.[targetId]) {
        if (!a3.roles[targetId].authority.includes("waive_policy")) {
          a3.roles[targetId].authority.push("waive_policy");
        }
      }
    } else if (type === "invalid_artifact" && targetId) {
      if (targetId === "A2") {
        this.state.artifacts.A2 = { claims: [] };
      }
    }
    this.state.phase = "blocked";
    this.state.lastMessage = `Fault injected [${type}]: ${details}`;
  }

  private resolveFault(
    type: MethodTeachingFaultType,
    targetId?: string,
  ): void {
    const fault = this.state.faults.find(
      (f) =>
        f.type === type &&
        (!targetId || !f.targetId || f.targetId === targetId) &&
        !f.resolved,
    );
    if (fault) {
      fault.resolved = true;
    }
    this.updatePhaseAfterRepair();
  }

  private updatePhaseAfterRepair(): void {
    const hasUnresolved = this.state.faults.some((f) => !f.resolved);
    if (
      !hasUnresolved &&
      !this.state.brokenLink &&
      !this.state.circularProof &&
      this.state.contractPinned
    ) {
      if (
        this.previousPhase &&
        this.previousPhase !== "blocked" &&
        this.previousPhase !== "not_started"
      ) {
        this.state.phase = this.previousPhase;
      } else if (this.state.transferCase) {
        this.state.phase = "metamethodological_transfer";
      } else if (this.state.fadedCase) {
        this.state.phase = "faded_practice";
      } else if (this.state.selfExplanation) {
        this.state.phase = "explained";
      } else if (this.state.externalReceipt) {
        this.state.phase = "externally_verified";
      } else if (this.state.links.length === RATIONALE_LINKS.length) {
        this.state.phase = "traceable";
      } else {
        this.state.phase = "working_map";
      }
    }
  }

  public repairPin(options?: {
    version?: string;
    digest?: string;
    profile?: string;
  }): MethodPinRepairResult {
    const version = options?.version || "1.0.0-draft";
    const digest =
      options?.digest || "sha256:methodological-guide-authoring-v1";
    const profile =
      (options?.profile as any) || this.state.completionProfile || "evidence_focused";

    this.state.contractPinned = true;
    this.state.contractPin = `methodological-guide-authoring@${version} + ${digest}`;
    this.state.completionProfile = profile;
    this.state.recoveryPracticed = true;

    this.resolveFault("pin_failure");

    return {
      recovered: true,
      pinnedVersion: version,
      pinnedDigest: digest,
      message: `Contract pin restored with version ${version} and digest ${digest}; all valid artifacts preserved.`,
    };
  }

  public repairArtifact(id: string, content: unknown): MethodRepairResult {
    this.state.artifacts[id] = content as string | unknown;
    this.state.recoveryPracticed = true;

    this.resolveFault("invalid_artifact", id);

    return {
      recovered: true,
      preservedArtifacts: Object.keys(this.state.artifacts),
      message: `Repaired artifact ${id} in place while preserving all existing valid artifacts.`,
    };
  }

  public repairAuthority(
    roleId: string,
    allowedAuthorities: string[],
  ): MethodAuthorityRepairResult {
    const a3 = this.state.artifacts.A3 as A3UserMap | undefined;
    if (a3?.roles?.[roleId]) {
      a3.roles[roleId].authority = [...allowedAuthorities];
    }
    this.state.recoveryPracticed = true;

    this.resolveFault("authority_failure", roleId);

    return {
      recovered: true,
      roleId,
      allowedAuthorities,
      message: `Revoked unauthorized authority from ${roleId}; restored strictly governed boundaries.`,
    };
  }

  public repairRationaleLink(
    brokenAnchor?: string,
    repairedLink?: string,
  ): MethodRepairResult {
    if (brokenAnchor && repairedLink) {
      this.state.links = this.state.links.map((l) =>
        l === brokenAnchor ? repairedLink : l,
      );
      if (!this.state.links.includes(repairedLink)) {
        this.state.links.push(repairedLink);
      }
    } else {
      this.state.links = [...RATIONALE_LINKS];
    }
    this.state.brokenLink = false;
    this.state.recoveryPracticed = true;

    this.resolveFault("rationale_failure");

    return {
      recovered: true,
      preservedArtifacts: Object.keys(this.state.artifacts),
      message:
        "Re-resolved broken rationale anchor to live guide citation; all artifacts preserved.",
    };
  }

  public repairCircularity(): MethodRepairResult {
    this.state.circularProof = false;
    this.state.selfConsistencySeparated = true;
    this.state.recoveryPracticed = true;

    this.resolveFault("circularity_failure");

    return {
      recovered: true,
      preservedArtifacts: Object.keys(this.state.artifacts),
      message:
        "Restored strict separation between external verification and self-consistency receipt classes.",
    };
  }

  public recordExternalVerification(receipts?: {
    expert_review?: string;
    novice_execution?: string;
    repository_pilot?: string;
  }): { success: boolean; message: string } {
    if (!this.state.contractPinned) {
      return {
        success: false,
        message: "Pin the contract before recording verification.",
      };
    }
    if (this.state.links.length < RATIONALE_LINKS.length) {
      return {
        success: false,
        message:
          "Resolve rationale links before external verification receipts.",
      };
    }
    this.state.externalReceipt = true;
    this.state.selfConsistencySeparated = true;
    this.state.currentSource =
      "independent reviewer + novice run + repository pilot";
    this.state.phase = "externally_verified";
    this.state.lastMessage =
      "Recorded external verification receipts: expert review, novice run, and 30-day pilot; self-consistency is isolated.";
    return { success: true, message: this.state.lastMessage };
  }

  public recordCircularProof(): { success: boolean; message: string } {
    this.state.circularProof = true;
    this.state.phase = "blocked";
    this.state.lastMessage =
      "Self-consistency proof was incorrectly substituted for external verification; completion fails closed.";
    return { success: true, message: this.state.lastMessage };
  }

  public submitSelfExplanation(answers?: {
    q1_expansion_signals?: string;
    q2_concise_a0?: string;
    q3_non_synthesized_authority?: string;
    q4_receipt_separation?: string;
    q5_targeted_recovery?: string;
  }): { success: boolean; message: string } {
    if (!this.state.externalReceipt) {
      return {
        success: false,
        message:
          "Complete runnable external verification before self-explanation.",
      };
    }
    if (answers) {
      const vals = Object.values(answers);
      if (vals.length > 0 && vals.some((a) => typeof a === "string" && a.trim().length < 5)) {
        return {
          success: false,
          message:
            "Each self-explanation prompt requires a substantive answer citing live guide anchors.",
        };
      }
    }
    this.state.selfExplanation = true;
    this.state.phase = "explained";
    this.state.lastMessage =
      "Explained why each A1-A7 expansion fired, why A0 stayed concise, and why an owner receipt cannot be inferred from prose.";
    return { success: true, message: this.state.lastMessage };
  }

  public completeFadedCase(projectOverride?: Partial<GuideProject>): {
    success: boolean;
    message: string;
  } {
    if (!this.state.selfExplanation) {
      return {
        success: false,
        message: "Explain the worked example before fading support.",
      };
    }
    const defaultIncident = createIncidentHandoffGuideProject();
    const fadedProj: GuideProject = {
      ...defaultIncident,
      ...(projectOverride || {}),
      artifacts: projectOverride?.artifacts
        ? (projectOverride.artifacts as any)
        : defaultIncident.artifacts,
    };

    const verification = verifyGuideProject(fadedProj);
    if (!verification.valid) {
      return {
        success: false,
        message: `Faded project validation failed: ${verification.problems.join("; ")}`,
      };
    }

    this.state.fadedProject = fadedProj;
    this.state.fadedCase = true;
    this.state.phase = "faded_practice";
    this.state.lastMessage =
      "Completed a partially supplied incident-handoff guide project producing every A0–A7 artifact triggered by observed signals with less guidance.";
    return { success: true, message: this.state.lastMessage };
  }

  public routeTransferCase(options?: {
    project?: GuideProject;
    round?: string;
    allowSelfInvocation?: boolean;
    allowActiveRewriting?: boolean;
  }): { success: boolean; message: string } {
    if (!this.state.fadedCase) {
      return {
        success: false,
        message: "Complete the faded case first.",
      };
    }

    if (options?.allowSelfInvocation) {
      this.state.selfInvocationDetected = true;
      this.state.phase = "blocked";
      this.state.lastMessage =
        "Acyclicity violation: active builder cannot invoke itself recursively.";
      return { success: false, message: this.state.lastMessage };
    }

    if (options?.allowActiveRewriting) {
      this.state.activeRewritingDetected = true;
      this.state.phase = "blocked";
      this.state.lastMessage =
        "Acyclicity violation: active builder cannot rewrite its own live source.";
      return { success: false, message: this.state.lastMessage };
    }

    const metamethodologyProject =
      options?.project || createMetamethodologicalGuideProject();

    const verification = verifyGuideProject(metamethodologyProject);
    if (!verification.valid) {
      return {
        success: false,
        message: `Metamethodological transfer validation failed: ${verification.problems.join("; ")}`,
      };
    }

    this.state.transferProject = metamethodologyProject;
    this.state.transferCase = true;
    this.state.selfConsistencyReceipt = true;
    this.state.selfConsistencySeparated = true;
    this.state.acyclicityVerified = true;
    this.state.phase = "metamethodological_transfer";
    this.state.lastMessage =
      "For a guide-authoring methodology, selected the metamethodological profile and separate immutable self-consistency assessments; the skill did not invoke or rewrite itself.";
    return { success: true, message: this.state.lastMessage };
  }

  public injectShadowContract(): void {
    this.state.shadowContract = true;
    this.state.lastMessage =
      "Generated a local copy of artifact schemas and method rules inside the teaching package.";
  }

  public discardContractPin(): void {
    this.state.contractPinned = false;
    this.state.contractPin = "none";
    this.state.lastMessage =
      "Removed the contract digest while retaining derived artifacts.";
  }

  public injectCircularProof(): void {
    this.state.circularProof = true;
    this.state.selfConsistencyReceipt = true;
    this.state.externalReceipt = true;
    this.state.lastMessage =
      "Relabeled a self-consistency receipt as proof that target users can apply the guide.";
  }

  public getBlockers(): string[] {
    const s = this.state;
    const allArtifactsPresent = Object.keys(ARTIFACT_REASONS).every(
      (id) => s.artifacts[id] !== undefined,
    );

    const unresolvedFaults = s.faults.filter((f) => !f.resolved);

    const reasons: Array<string | false> = [
      !s.task && "the meaningful guide-authoring task was not attempted",
      !s.contractPinned &&
        "the Method Contract version and digest are not pinned",
      !s.artifacts.A0 && "A0 is missing",
      !allArtifactsPresent &&
        "one or more triggered A1-A7 artifacts are missing",
      s.links.length !== RATIONALE_LINKS.length &&
        "material rules do not all resolve to live rationale anchors",
      s.brokenLink && "a rationale link remains broken",
      !s.recoveryPracticed && "the targeted recovery exercise is unfinished",
      !s.externalReceipt && "external verification has no owner receipt",
      !s.selfExplanation && "self-explanation prompts are unanswered",
      !s.fadedCase && "the faded case is unfinished",
      !s.transferCase && "the metamethodological transfer was not routed",
      !s.selfConsistencySeparated &&
        "self-consistency is not kept as a separate receipt class",
      s.shadowContract && "the lesson created a shadow Method Contract",
      s.circularProof &&
        "circular proof: self-consistency was used as empirical effectiveness evidence",
      s.selfInvocationDetected &&
        "acyclicity violation: self-invocation detected",
      s.activeRewritingDetected &&
        "acyclicity violation: active rewriting detected",
      unresolvedFaults.length > 0 &&
        `unresolved injected faults: ${unresolvedFaults.map((f) => f.type).join(", ")}`,
    ];

    return reasons.filter((r): r is string => Boolean(r));
  }

  public attemptCompletion(): { passed: boolean; blockers: string[] } {
    const blockers = this.getBlockers();
    if (blockers.length > 0) {
      this.state.status = "rejected";
      this.state.phase = "blocked";
      this.state.lastMessage = `Completion rejected: ${blockers.join("; ")}.`;
      return { passed: false, blockers };
    }
    this.state.status = "independent";
    this.state.phase = "complete";
    this.state.lastMessage =
      "Completion passed: one pinned, traceable, recovered, externally verified guide project plus faded and metamethodological transfer cases.";
    return { passed: true, blockers: [] };
  }

  public getRunReport(): MethodologyRunReport {
    const receipts: MethodologyRunReceipt[] = [];
    if (this.state.externalReceipt) {
      receipts.push({
        id: "REC-external-verification-review",
        type: "external_verification",
        profile: "evidence_focused",
        digest: "sha256:external-verification-receipt-digest",
        status: "ACCEPTED",
      });
    }
    if (this.state.selfConsistencyReceipt) {
      receipts.push({
        id: "REC-self-consistency-fixed-point",
        type: "self_consistency",
        profile: "metamethodological",
        digest: "sha256:self-consistency-fixed-point-digest",
        status: "ACCEPTED",
      });
    }

    return {
      taskId: this.state.manifest.taskId,
      status: this.state.status,
      declaredInputs: this.state.manifest.declaredInputs,
      prohibitedInputs: [...this.state.prohibitedInputsDetected],
      interventions: [...this.state.interventions],
      routeChoices: [...this.state.routeChoices],
      artifacts: Object.keys(this.state.artifacts),
      receipts,
    };
  }

  public getClaimsReport(): MethodologyClaimsReport {
    const s = this.state;

    // 1. Faded performance claim
    const fadedValid =
      s.fadedCase &&
      s.fadedProject !== undefined &&
      verifyGuideProject(s.fadedProject).valid;
    const fadedStatus: MethodClaimStatus = s.fadedCase
      ? fadedValid
        ? "SUPPORTED"
        : "FALSIFIED"
      : "FALSIFIED";
    const fadedEvaluation: MethodClaimEvaluation = {
      claim:
        "A faded incident-handoff case produces complete A0-A7 artifacts with less guidance.",
      status: fadedStatus,
      evidence: s.fadedCase
        ? `Faded case completed with all 8 artifacts present and valid in ${s.fadedProject?.id || "faded project"}.`
        : "Faded case was not completed.",
      justification:
        "Validates that the learner can author a complete guide with partial scaffolding withheld.",
    };

    // 2. Structural transfer claim
    const transferValid =
      s.transferCase &&
      s.transferProject !== undefined &&
      verifyGuideProject(s.transferProject).valid;
    const transferStatus: MethodClaimStatus = s.transferCase
      ? transferValid
        ? "SUPPORTED"
        : "FALSIFIED"
      : "FALSIFIED";
    const transferEvaluation: MethodClaimEvaluation = {
      claim:
        "Metamethodological transfer routes correctly to metamethodological profile with distinct self-consistency receipts.",
      status: transferStatus,
      evidence: s.transferCase
        ? `Metamethodological transfer completed with profile ${s.transferProject?.contract_pin.profile} and isolated self-consistency receipts.`
        : "Metamethodological transfer was not routed.",
      justification:
        "Validates transfer to self-application without confusing self-consistency with external evidence.",
    };

    // 3. Targeted recovery claim
    let recoveryStatus: MethodClaimStatus = "INCONCLUSIVE";
    let recoveryEvidence = "Targeted recovery was not exercised.";
    if (s.faults.length > 0) {
      const unresolved = s.faults.filter((f) => !f.resolved);
      if (unresolved.length === 0) {
        recoveryStatus = "SUPPORTED";
        recoveryEvidence = `All ${s.faults.length} injected fault(s) resolved at affected boundaries without restarting unrelated work.`;
      } else {
        recoveryStatus = "FALSIFIED";
        recoveryEvidence = `${unresolved.length}/${s.faults.length} fault(s) remain unresolved: ${unresolved.map((f) => f.type).join(", ")}.`;
      }
    } else if (s.recoveryPracticed) {
      recoveryStatus = "SUPPORTED";
      recoveryEvidence = "Targeted recovery was practiced and verified.";
    }

    const recoveryEvaluation: MethodClaimEvaluation = {
      claim:
        "Pin, artifact, rationale, authority, and circularity failures stop at affected boundaries and recover precisely.",
      status: recoveryStatus,
      evidence: recoveryEvidence,
      justification:
        "Ensures failures do not require full workflow restarts or destroy prior valid artifacts.",
    };

    // 4. Acyclicity claim
    let acyclicityStatus: MethodClaimStatus = "INCONCLUSIVE";
    let acyclicityEvidence = "Acyclicity was not evaluated.";
    if (s.selfInvocationDetected || s.activeRewritingDetected) {
      acyclicityStatus = "FALSIFIED";
      acyclicityEvidence = `Acyclicity violated: self_invocation=${s.selfInvocationDetected}, active_rewriting=${s.activeRewritingDetected}.`;
    } else if (s.acyclicityVerified) {
      acyclicityStatus = "SUPPORTED";
      acyclicityEvidence =
        "Acyclicity verified: no self-invocation, no active rewriting, and immutable bootstrap round boundaries enforced.";
    }

    const acyclicityEvaluation: MethodClaimEvaluation = {
      claim:
        "Active builders and harnesses never invoke or rewrite themselves during metamethodological transfer.",
      status: acyclicityStatus,
      evidence: acyclicityEvidence,
      justification:
        "Enforces strict acyclic bootstrap rounds and prohibits runaway runtime recursion.",
    };

    const overallPassed =
      fadedStatus === "SUPPORTED" &&
      transferStatus === "SUPPORTED" &&
      acyclicityStatus === "SUPPORTED" &&
      recoveryStatus !== "FALSIFIED" &&
      !s.shadowContract &&
      !s.circularProof;

    return {
      overallPassed,
      claims: {
        faded_performance: fadedEvaluation,
        structural_transfer: transferEvaluation,
        targeted_recovery: recoveryEvaluation,
        acyclicity: acyclicityEvaluation,
      },
    };
  }

  public runPrototypeSelfCheck(): PrototypeSelfCheckResult {
    const run = (actions: string[]): MethodTeachingState => {
      const sess = new MethodologyTeachingSession();
      for (const a of actions) {
        switch (a) {
          case "task":
            sess.startTask();
            break;
          case "pin":
            sess.pinContract();
            break;
          case "a0":
            sess.draftA0();
            break;
          case "a1":
            sess.expandArtifact("A1");
            break;
          case "a2":
            sess.expandArtifact("A2");
            break;
          case "a3":
            sess.expandArtifact("A3");
            break;
          case "a4":
            sess.expandArtifact("A4");
            break;
          case "a5":
            sess.expandArtifact("A5");
            break;
          case "a6":
            sess.expandArtifact("A6");
            break;
          case "a7":
            sess.expandArtifact("A7");
            break;
          case "trace":
            sess.resolveRationaleLinks();
            break;
          case "break-link":
            sess.breakRationaleLink();
            break;
          case "repair":
            sess.runTargetedRecovery();
            break;
          case "external":
            sess.recordExternalVerification();
            break;
          case "explain":
            sess.submitSelfExplanation();
            break;
          case "fade":
            sess.completeFadedCase();
            break;
          case "transfer":
            sess.routeTransferCase();
            break;
          case "shadow":
            sess.injectShadowContract();
            break;
          case "unpin":
            sess.discardContractPin();
            break;
          case "circular":
            sess.injectCircularProof();
            break;
        }
      }
      sess.attemptCompletion();
      return sess.getState();
    };

    const complete = run(COMPLETE_ACTIONS);
    const shadow = run([...COMPLETE_ACTIONS, "shadow"]);
    const unpinned = run([...COMPLETE_ACTIONS, "unpin"]);
    const circular = run([
      ...COMPLETE_ACTIONS.slice(0, 13),
      "circular",
      "explain",
      "fade",
      "transfer",
    ]);
    const unrepaired = run([
      "task",
      "pin",
      "a0",
      "a1",
      "a2",
      "a3",
      "a4",
      "a5",
      "a6",
      "a7",
      "trace",
      "break-link",
      "external",
      "explain",
      "fade",
      "transfer",
    ]);

    const passed =
      complete.status === "independent" &&
      shadow.status === "rejected" &&
      unpinned.status === "rejected" &&
      circular.status === "rejected" &&
      unrepaired.status === "rejected";

    return {
      passed,
      pathsPassed: 5,
      message: passed
        ? "5 deterministic paths passed"
        : "Methodology-authoring teaching invariant failed",
    };
  }
}

