import type {
  ArtifactEnvelopeRecord,
  AttemptCursorRecord,
  CandidateEvaluationResult,
  ContextManifestPointer,
  HarnessArtifactContract,
  HarnessCandidateSelection,
  HarnessClaimsReport,
  HarnessComparisonArm,
  HarnessDeclaredInputItem,
  HarnessDeclaredInputManifest,
  HarnessLifecycleRecord,
  HarnessOutcomeRequirements,
  HarnessOwnershipMap,
  HarnessProject,
  HarnessRecoveryPolicy,
  HarnessRunReport,
  HarnessSelfCheckResult,
  HarnessTeachingFault,
  HarnessTeachingPhase,
  HarnessTeachingState,
  HarnessTeachingStatus,
  HarnessTriggerDecision,
  HostCapabilityAdapterContract,
} from "./types.js";
import {
  createDefaultArtifactContract,
  createDefaultCandidateSelection,
  createDefaultHarnessDeclaredManifest,
  createDefaultHarnessProject,
  createDefaultLifecycleRecord,
  createDefaultOutcomeRequirements,
  createDefaultOwnershipMap,
  createDefaultRecoveryPolicy,
  createThinBaselineHarnessProject,
  KERNEL_TRIGGERED_MECHANISMS,
  verifyHarnessProject,
} from "./verifier.js";
import { createIssueTriageHarnessProject } from "./issue-triage.js";
import { createStagedSelfApplicationHarnessProject } from "./staged-self-application.js";

const KERNEL_FEATURE_NAMES = [
  "content-addressed context manifest",
  "repository-visible attempt cursor",
  "closed artifact and receipt gates",
  "host capability adapter",
  "pending approval pointer",
  "idempotency and replay declaration",
  "normalized lifecycle and trace correlation",
  "version and digest pin gate",
];

export class HarnessTeachingSession {
  private state: HarnessTeachingState;

  constructor(initialManifest?: HarnessDeclaredInputManifest) {
    this.state = this.createInitialState(initialManifest);
  }

  private createInitialState(
    manifest?: HarnessDeclaredInputManifest,
  ): HarnessTeachingState {
    return {
      phase: "not_started",
      status: "learning",
      taskClass: "none",
      pins: false,
      requirements: [],
      ownersPlaced: false,
      baselineTested: false,
      baselineFailures: [],
      candidate: "unselected",
      features: [],
      artifactContract: false,
      ambiguousEffect: false,
      recoveryPracticed: false,
      evaluated: false,
      lifecycle: false,
      selfExplanation: false,
      fadedCase: false,
      transferCase: false,
      acyclicityVerified: false,
      selfInvocationDetected: false,
      runtimeRecursionDetected: false,
      shadowState: false,
      duplicateEffect: false,
      pinDrift: false,
      runtimeRecursion: false,
      lastMessage: "No harness-authoring task has been presented.",
      manifest: manifest || createDefaultHarnessDeclaredManifest(),
      prohibitedInputsDetected: [],
      interventions: [],
      routeChoices: [
        ".agents/skills/methodize-harness/SKILL.md",
        "references/harness-research.md",
      ],
      faults: [],
      artifacts: [
        "ART-harness-manifest",
        "ART-harness-ownership-map",
        "ART-harness-candidate-selection",
        "ART-harness-artifact-contract",
        "ART-harness-recovery-policy",
        "ART-harness-lifecycle-record",
      ],
      receipts: [
        {
          id: "RECEIPT-harness-init",
          type: "lifecycle_receipt",
          owner: "orchestration_harness",
          digest: "sha256:harness-init-receipt-v1",
        },
      ],
    };
  }

  public getState(): HarnessTeachingState {
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

  public recordFault(
    type: HarnessTeachingFault["type"],
    details: string,
    target?: string,
  ): void {
    this.state.faults.push({
      type,
      details,
      target,
      resolved: false,
      timestamp: new Date().toISOString(),
    });

    if (type === "pin_mismatch") {
      this.state.pins = false;
      this.state.pinDrift = true;
      this.state.phase = "blocked";
    } else if (type === "shadow_state" || type === "ownership_conflict") {
      this.state.shadowState = true;
      this.state.phase = "blocked";
    } else if (type === "ambiguous_side_effect") {
      this.state.ambiguousEffect = true;
      this.state.phase = "waiting_for_inspection";
    } else if (type === "ambiguous_effect_duplicate_replay") {
      this.state.duplicateEffect = true;
      this.state.ambiguousEffect = false;
      this.state.phase = "blocked";
    } else if (type === "runtime_recursion") {
      this.state.runtimeRecursion = true;
      this.state.phase = "blocked";
    } else {
      this.state.phase = "blocked";
    }

    this.state.lastMessage = details;
  }

  private restoreUnblockedPhase(fallback: HarnessTeachingPhase): void {
    if (this.state.phase === "blocked") {
      this.state.phase = this.state.transferCase
        ? "staged_transfer"
        : this.state.fadedCase
        ? "faded_practice"
        : this.state.selfExplanation
        ? "explained"
        : fallback;
    }
  }

  public repairPin(options?: {
    contractVersion?: string;
    contractDigest?: string;
  }): { recovered: boolean; message: string } {
    this.state.pins = true;
    this.state.pinDrift = false;

    if (options?.contractDigest) {
      const contractInput = this.state.manifest.declaredInputs.find(
        (i) => i.role === "method-contract",
      );
      if (contractInput) {
        contractInput.digest = options.contractDigest;
        if (options.contractVersion) {
          contractInput.version = options.contractVersion;
        }
      }
    }

    for (const f of this.state.faults) {
      if (f.type === "pin_mismatch") {
        f.resolved = true;
      }
    }

    this.restoreUnblockedPhase("sources_pinned");
    this.state.lastMessage = "Restored matching source pins and digests.";
    return { recovered: true, message: this.state.lastMessage };
  }

  public repairPointer(
    pointerId: string,
    repairedPointer?: Partial<ContextManifestPointer>,
  ): { recovered: boolean; pointerId: string; message: string } {
    for (const f of this.state.faults) {
      if (f.type === "invalid_pointer" && (!f.target || f.target === pointerId)) {
        f.resolved = true;
        if (repairedPointer) {
          f.details = `Repaired: ${JSON.stringify(repairedPointer)}`;
        }
      }
    }

    this.restoreUnblockedPhase("artifact_contract");
    this.state.lastMessage = `Repaired context manifest pointer ${pointerId} in place.`;
    return { recovered: true, pointerId, message: this.state.lastMessage };
  }

  public repairOwnership(
    owner: string,
    allowedResponsibilities: string[],
  ): { recovered: boolean; owner: string; allowedResponsibilities: string[]; message: string } {
    this.state.shadowState = false;

    for (const f of this.state.faults) {
      if (
        (f.type === "ownership_conflict" || f.type === "shadow_state") &&
        (!f.target || f.target === owner)
      ) {
        f.resolved = true;
        f.details = `Restricted to: ${allowedResponsibilities.join(", ")}`;
      }
    }

    this.restoreUnblockedPhase("ownership_boundary");
    this.state.lastMessage = `Restored strict single-ownership boundary for ${owner}.`;
    return { recovered: true, owner, allowedResponsibilities, message: this.state.lastMessage };
  }

  public repairCapability(
    adapterId: string,
    supportedCapabilities: Record<string, unknown>,
  ): { recovered: boolean; adapterId: string; supportedCapabilities: Record<string, unknown>; message: string } {
    for (const f of this.state.faults) {
      if (
        f.type === "unsupported_capability" &&
        (!f.target || f.target === adapterId)
      ) {
        f.resolved = true;
        f.details = `Capabilities provided: ${JSON.stringify(supportedCapabilities)}`;
      }
    }

    this.restoreUnblockedPhase("artifact_contract");
    this.state.lastMessage = `Updated host adapter capability contract for ${adapterId}.`;
    return { recovered: true, adapterId, supportedCapabilities, message: this.state.lastMessage };
  }

  public repairRuntimeRecursion(): { recovered: boolean; message: string } {
    this.state.runtimeRecursion = false;
    this.state.runtimeRecursionDetected = false;

    for (const f of this.state.faults) {
      if (f.type === "runtime_recursion") {
        f.resolved = true;
      }
    }

    if (this.state.phase === "blocked") {
      this.state.phase = "staged_transfer";
    }

    this.state.lastMessage =
      "Removed runtime recursion and restored acyclic build-time boundary.";
    return { recovered: true, message: this.state.lastMessage };
  }

  public startTask(
    kind: "cross-session" | "single-session" = "cross-session",
  ): { success: boolean; message: string } {
    this.state.taskClass = kind;
    this.state.phase = "meaningful_task";
    if (kind === "cross-session") {
      this.state.lastMessage =
        "Task: Design the smallest harness that resumes a dependency-review method after process loss, preserves an approval wait, and never duplicates an ambiguous publication effect.";
    } else {
      this.state.lastMessage =
        "Task: Design support for one read-only, single-session contract validation with no pause, external effect, or host variation.";
    }
    return { success: true, message: this.state.lastMessage };
  }

  public pinSources(options?: {
    guideVersion?: string;
    guideDigest?: string;
    contractVersion?: string;
    contractDigest?: string;
    skillVersion?: string;
    skillDigest?: string;
    researchVersion?: string;
    researchDigest?: string;
    workspaceRevision?: string;
    hostCapabilityVersion?: string;
  }): { success: boolean; message: string } {
    if (this.state.taskClass === "none") {
      return { success: false, message: "Stopped: start with a harness task." };
    }
    this.state.pins = true;
    this.state.phase = "sources_pinned";
    this.state.lastMessage =
      "Pinned G_n, M_n, MA_n, the harness research snapshot, workspace revision, and host capability record by version and digest.";
    return { success: true, message: this.state.lastMessage };
  }

  public defineOutcomeRequirements(
    requirements?: string[],
  ): { success: boolean; message: string } {
    if (!this.state.pins) {
      return {
        success: false,
        message: "Stopped: pin the normative and research sources first.",
      };
    }
    this.state.requirements =
      requirements ||
      (this.state.taskClass === "cross-session"
        ? [
            "cold start",
            "mid-run resume",
            "approval preservation",
            "no ambiguous replay",
            "artifact rejection",
            "pin rejection",
            "trace correlation",
          ]
        : ["contract validation"]);
    this.state.phase = "outcome_tests";
    this.state.lastMessage =
      "Defined repository-observable pass and fail outcomes before choosing a runtime shape.";
    return { success: true, message: this.state.lastMessage };
  }

  public assignOwnership(
    map?: HarnessOwnershipMap,
  ): { success: boolean; message: string } {
    if (!this.state.requirements.length) {
      return {
        success: false,
        message: "Stopped: define outcome tests before placing mechanisms.",
      };
    }
    this.state.ownersPlaced = true;
    this.state.phase = "ownership_boundary";
    this.state.lastMessage =
      "Method owns rules; Ariadne owns epistemic state; tracker owns work; host owns model, tools, sandbox, approvals, and native traces; harness may own only attempt pointers and generic gates.";
    return { success: true, message: this.state.lastMessage };
  }

  public testBaseline(): { success: boolean; failures: string[]; message: string } {
    if (!this.state.ownersPlaced) {
      return {
        success: false,
        failures: [],
        message: "Stopped: place owner boundaries before testing candidates.",
      };
    }
    this.state.baselineTested = true;
    this.state.baselineFailures =
      this.state.taskClass === "cross-session"
        ? ["mid-run resume", "ambiguous side effect"]
        : [];
    this.state.phase = "baseline_measured";
    this.state.lastMessage = this.state.baselineFailures.length
      ? "The thin package passed cold loading but could not enforce reset continuity or resolve an ambiguous side effect without hidden human memory."
      : "The thin package satisfied the only required read-only contract check; a kernel has no remaining job.";
    return {
      success: true,
      failures: this.state.baselineFailures,
      message: this.state.lastMessage,
    };
  }

  public selectCandidate(
    candidateChoice?:
      | "minimal neutral kernel"
      | "thin baseline"
      | "host-specific plugin",
  ): { success: boolean; message: string } {
    if (!this.state.baselineTested) {
      return {
        success: false,
        message: "Stopped: test the thin baseline before selecting a candidate.",
      };
    }
    const requiresKernel = this.state.baselineFailures.length > 0;
    this.state.candidate =
      candidateChoice ||
      (requiresKernel ? "minimal neutral kernel" : "thin baseline");
    this.state.phase = "candidate_selected";
    this.state.lastMessage =
      this.state.candidate === "minimal neutral kernel"
        ? "Selected the minimal neutral kernel; the host-specific plugin failed the host-neutral requirement and the reference-only package failed resume and replay requirements."
        : "Selected the thin baseline and deleted the proposed kernel because no required behavior remained.";
    return { success: true, message: this.state.lastMessage };
  }

  public applyTriggeredMechanisms(
    features?: string[],
  ): { success: boolean; message: string } {
    if (this.state.candidate === "unselected") {
      return {
        success: false,
        message: "Stopped: select a candidate after the baseline result.",
      };
    }
    const requiresKernel = this.state.baselineFailures.length > 0;
    this.state.features =
      features || (requiresKernel ? [...KERNEL_FEATURE_NAMES] : []);
    this.state.phase = "triggered_mechanisms";
    this.state.lastMessage = requiresKernel
      ? "Added one mechanism for each observed continuation, artifact, host, approval, replay, trace, and pin requirement."
      : "No runtime mechanism fired; the lesson records the trimmed baseline verdict.";
    return { success: true, message: this.state.lastMessage };
  }

  public defineArtifactContract(
    contract?: HarnessArtifactContract,
  ): { success: boolean; message: string } {
    if (this.state.candidate === "unselected") {
      return {
        success: false,
        message: "Stopped: select the smallest candidate first.",
      };
    }
    const requiresKernel = this.state.baselineFailures.length > 0;
    if (
      requiresKernel &&
      this.state.features.length !== KERNEL_FEATURE_NAMES.length
    ) {
      return {
        success: false,
        message: "Stopped: apply the observed mechanism triggers first.",
      };
    }
    this.state.artifactContract = true;
    this.state.phase = "artifact_contract";
    this.state.lastMessage =
      "Defined source pins, ordered context pointers, attempt cursor, artifact envelopes, pending-action references, normalized events, owner receipts, and completion predicates without copied owner payloads.";
    return { success: true, message: this.state.lastMessage };
  }

  public injectAmbiguousEffect(): { success: boolean; message: string } {
    const requiresKernel = this.state.baselineFailures.length > 0;
    if (!this.state.artifactContract || !requiresKernel) {
      return {
        success: false,
        message:
          "Stopped: the cross-session kernel contract must exist before failure injection.",
      };
    }
    this.state.ambiguousEffect = true;
    this.state.phase = "waiting_for_inspection";
    this.state.lastMessage =
      "Process loss followed dependency-review publication but preceded its receipt; the attempt remains waiting and records an ambiguous-effect pointer.";
    return { success: true, message: this.state.lastMessage };
  }

  public recoverAmbiguousEffect(receipt?: {
    receiptId: string;
    ownerVerification: string;
  }): { success: boolean; message: string } {
    if (!this.state.ambiguousEffect && !this.state.faults.some((f) => f.type === "ambiguous_side_effect")) {
      return {
        success: false,
        message: "Stopped: recovery requires an observed ambiguous effect.",
      };
    }
    this.state.ambiguousEffect = false;
    this.state.recoveryPracticed = true;
    this.state.duplicateEffect = false;

    for (const f of this.state.faults) {
      if (
        f.type === "ambiguous_side_effect" ||
        f.type === "ambiguous_effect_duplicate_replay"
      ) {
        f.resolved = true;
      }
    }

    if (this.state.phase === "waiting_for_inspection" || this.state.phase === "blocked") {
      this.state.phase = "recovered";
    }

    if (receipt) {
      this.state.receipts.push({
        id: receipt.receiptId,
        type: "owner_effect_receipt",
        owner: "tracker",
        digest: "sha256:owner-effect-receipt-v1",
      });
    }

    this.state.lastMessage =
      "The owner inspected the external effect, attached its receipt, and resumed without automatic replay.";
    return { success: true, message: this.state.lastMessage };
  }

  public evaluateLifecycleFixtures(): { success: boolean; message: string } {
    if (!this.state.artifactContract) {
      return {
        success: false,
        message: "Stopped: write the artifact contract before evaluating it.",
      };
    }
    const requiresKernel = this.state.baselineFailures.length > 0;
    if (requiresKernel && !this.state.recoveryPracticed) {
      return {
        success: false,
        message:
          "Stopped: practice ambiguous-effect recovery before the evaluation pass.",
      };
    }
    this.state.evaluated = true;
    this.state.phase = "evaluated";
    this.state.lastMessage = requiresKernel
      ? "Cold start, mid-run reset, approval reset, ambiguous effect, corrupt artifact, pin drift, and adapter conformance fixtures produced the expected repository outcomes."
      : "The read-only baseline passed its contract fixture and the proposed kernel remained absent.";
    return { success: true, message: this.state.lastMessage };
  }

  public recordLifecycleGuidance(
    record?: HarnessLifecycleRecord,
  ): { success: boolean; message: string } {
    if (!this.state.evaluated) {
      return {
        success: false,
        message:
          "Stopped: evaluate repository outcomes before locking lifecycle guidance.",
      };
    }
    this.state.lifecycle = true;
    this.state.phase = "lifecycle_recorded";
    this.state.lastMessage =
      "Recorded owner, pins, review triggers, feedback, compatibility, retirement, and the rule to inline or delete the kernel when the thin baseline satisfies all hard invariants.";
    return { success: true, message: this.state.lastMessage };
  }

  public answerSelfExplanation(answers?: Record<string, string>): {
    success: boolean;
    message: string;
  } {
    if (!this.state.lifecycle) {
      return {
        success: false,
        message: "Stopped: complete the worked design before self-explanation.",
      };
    }
    this.state.selfExplanation = true;
    this.state.phase = "explained";
    this.state.lastMessage =
      "Explained every ownership boundary, trigger, stop, retry decision, trace field, and why the baseline result controls whether a kernel exists.";
    return { success: true, message: this.state.lastMessage };
  }

  public completeFadedCase(
    project?: Partial<HarnessProject>,
  ): { success: boolean; message: string } {
    if (!this.state.selfExplanation) {
      return {
        success: false,
        message: "Stopped: explain the complete example before fading support.",
      };
    }

    let targetProject: HarnessProject;
    if (project) {
      const verification = verifyHarnessProject(project as HarnessProject);
      if (!verification.valid) {
        return {
          success: false,
          message: `Validation failed: ${verification.problems.join("; ")}`,
        };
      }
      targetProject = project as HarnessProject;
    } else {
      targetProject = createIssueTriageHarnessProject();
    }

    this.state.fadedProject = targetProject;
    this.state.fadedCase = true;
    this.state.phase = "faded_practice";
    this.state.lastMessage =
      "Completed a partially supplied issue-triage harness design with the owner map, candidate verdict, recovery policy, and lifecycle decision withheld.";
    return { success: true, message: this.state.lastMessage };
  }

  public routeTransferCase(options?: {
    allowSelfInvocation?: boolean;
    allowRuntimeRecursion?: boolean;
    project?: Partial<HarnessProject>;
  }): { success: boolean; message: string } {
    if (!this.state.fadedCase) {
      return {
        success: false,
        message: "Stopped: complete the faded case first.",
      };
    }

    if (options?.allowSelfInvocation) {
      this.state.selfInvocationDetected = true;
      this.state.phase = "blocked";
      this.recordFault(
        "runtime_recursion",
        "Acyclicity violation: active builder self-invocation detected",
      );
      return {
        success: false,
        message: "Acyclicity violation: active builder self-invocation detected",
      };
    }

    if (options?.allowRuntimeRecursion) {
      this.state.runtimeRecursionDetected = true;
      this.state.phase = "blocked";
      this.recordFault(
        "runtime_recursion",
        "Acyclicity violation: runtime recursion detected",
      );
      return {
        success: false,
        message: "Acyclicity violation: runtime recursion detected",
      };
    }

    let targetProject: HarnessProject;
    if (options?.project) {
      const verification = verifyHarnessProject(options.project as HarnessProject);
      if (!verification.valid) {
        return {
          success: false,
          message: `Validation failed: ${verification.problems.join("; ")}`,
        };
      }
      targetProject = options.project as HarnessProject;
    } else {
      targetProject = createStagedSelfApplicationHarnessProject();
    }

    this.state.transferProject = targetProject;
    this.state.transferCase = true;
    this.state.acyclicityVerified = true;
    this.state.selfInvocationDetected = false;
    this.state.runtimeRecursionDetected = false;
    this.state.phase = "staged_transfer";
    this.state.lastMessage =
      "Routed HA_n to build OH_n, then OH_n to two isolated applications of M_n; the active skill and harness never invoke or rewrite their builders.";
    return { success: true, message: this.state.lastMessage };
  }

  public injectShadowState(): void {
    this.recordFault(
      "shadow_state",
      "Copied Ariadne claims, tracker status, and host approval state into the harness ledger.",
    );
  }

  public injectDuplicateReplay(): void {
    this.recordFault(
      "ambiguous_effect_duplicate_replay",
      "Automatically retried publication without an owner replay declaration or inspection receipt.",
    );
  }

  public injectPinDrift(): void {
    this.recordFault(
      "pin_mismatch",
      "Removed the Method Contract digest while retaining derived run and artifact records.",
    );
  }

  public injectRuntimeRecursion(): void {
    this.recordFault(
      "runtime_recursion",
      "Configured OH_n to invoke HA_n during its own active self-application round.",
    );
  }

  public getBlockers(): string[] {
    const s = this.state;
    const requiresKernel = s.baselineFailures.length > 0;
    const list: (string | false)[] = [
      s.taskClass === "none" && "the meaningful harness task was not attempted",
      !s.pins &&
        "guide, Method Contract, teaching-skill, and research digests are not pinned",
      !s.requirements.length &&
        "observable outcome and failure tests are missing",
      !s.ownersPlaced && "owner boundaries are missing",
      !s.baselineTested && "the thin baseline was not tested",
      s.candidate === "unselected" && "no candidate verdict exists",
      requiresKernel &&
        s.features.length !== KERNEL_FEATURE_NAMES.length &&
        "one or more observed kernel triggers are unsatisfied",
      !requiresKernel &&
        s.features.length > 0 &&
        "unneeded kernel mechanisms survived trimming",
      !s.artifactContract && "the pointer-only artifact contract is missing",
      requiresKernel &&
        !s.recoveryPracticed &&
        "ambiguous-effect recovery was not practiced",
      !s.evaluated && "lifecycle fixtures were not evaluated",
      !s.lifecycle && "version, review, and deletion triggers are missing",
      !s.selfExplanation && "self-explanation prompts are unanswered",
      !s.fadedCase && "the faded case is unfinished",
      !s.transferCase && "the staged self-application transfer is unfinished",
      s.shadowState && "the harness copied owner state",
      s.duplicateEffect &&
        "an ambiguous side effect was automatically replayed",
      s.pinDrift && "derived state no longer matches the pinned sources",
      s.runtimeRecursion && "the runtime invokes its active builder",
      Boolean(s.selfInvocationDetected) &&
        "the active builder attempted self-invocation",
      Boolean(s.runtimeRecursionDetected) &&
        "the runtime attempted recursive invocation of builder",
    ];
    return list.filter((item): item is string => typeof item === "string");
  }

  public attemptCompletion(): {
    passed: boolean;
    status: HarnessTeachingStatus;
    blockers: string[];
    message: string;
  } {
    const blockers = this.getBlockers();
    if (blockers.length > 0) {
      this.state.status = "rejected";
      this.state.phase = "blocked";
      this.state.lastMessage = `Completion rejected: ${blockers.join("; ")}.`;
      return {
        passed: false,
        status: "rejected",
        blockers,
        message: this.state.lastMessage,
      };
    }

    if (this.state.candidate === "thin baseline") {
      this.state.status = "trimmed";
      this.state.phase = "complete";
      this.state.lastMessage =
        "Completion passed with no new kernel: the baseline satisfies every hard requirement.";
      return {
        passed: true,
        status: "trimmed",
        blockers: [],
        message: this.state.lastMessage,
      };
    }

    this.state.status = "independent";
    this.state.phase = "complete";
    this.state.lastMessage =
      "Completion passed: one minimal owner-safe harness design, recovered failure, lifecycle evaluation, faded case, and acyclic transfer.";
    return {
      passed: true,
      status: "independent",
      blockers: [],
      message: this.state.lastMessage,
    };
  }

  public getRunReport(): HarnessRunReport {
    const sourcePinsMap: Record<string, string> = {};
    for (const input of this.state.manifest.declaredInputs) {
      sourcePinsMap[input.role] = `${input.version || "1.0.0"}${
        input.digest ? ` (${input.digest})` : ""
      }`;
    }

    const hostCapabilities: Record<string, boolean | string | string[]> = {
      supported_versions: ["1.0.0"],
      supports_resume: true,
      supports_native_approvals: true,
      supports_trace_correlation: true,
      sandbox_isolation_level: "process-sandbox",
    };

    const criticalCriteria = [
      "Cold start loading from repository",
      "Mid-run continuation across processes",
      "Ambiguous side-effect safe recovery",
      "Single ownership without shadow state",
      "Acyclic build-time boundary enforcement",
    ];

    const buildArm = (taskId: string): HarnessComparisonArm => ({
      taskId,
      sourcePins: { ...sourcePinsMap },
      capabilities: { ...hostCapabilities },
      criticalCriteria: [...criticalCriteria],
    });

    return {
      taskId: this.state.manifest.taskId,
      taskDescription: this.state.manifest.taskDescription,
      declaredInputs: this.state.manifest.declaredInputs,
      prohibitedInputs: [...this.state.prohibitedInputsDetected],
      interventions: [...this.state.interventions],
      routeChoices: [...this.state.routeChoices],
      artifacts: [...this.state.artifacts],
      receipts: [...this.state.receipts],
      comparisonArms: {
        teaching_skill_arm: buildArm(this.state.manifest.taskId),
        thin_baseline_arm: buildArm(this.state.manifest.taskId),
      },
    };
  }

  public getClaimsReport(): HarnessClaimsReport {
    // 1. Faded performance
    const fadedSupported = this.state.fadedCase && !!this.state.fadedProject;
    const fadedClaim = {
      status: fadedSupported ? ("SUPPORTED" as const) : ("FALSIFIED" as const),
      evidence: fadedSupported
        ? "Issue-triage continuation case completed with schema-valid project selecting only observed triggers"
        : "Faded case not completed or missing project record",
    };

    // 2. Structural transfer
    const transferSupported =
      this.state.transferCase &&
      this.state.acyclicityVerified &&
      !this.state.selfInvocationDetected &&
      !this.state.runtimeRecursionDetected;
    const transferClaim = {
      status: transferSupported ? ("SUPPORTED" as const) : ("FALSIFIED" as const),
      evidence: transferSupported
        ? "Staged self-application transfer case completed with verified acyclic build-time boundary"
        : "Transfer case not completed or acyclicity violation detected",
    };

    // 3. Targeted recovery
    let recoveryClaim: {
      status: "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE";
      evidence: string;
    };
    if (this.state.faults.length === 0) {
      recoveryClaim = {
        status: "INCONCLUSIVE",
        evidence: "No faults injected; clean baseline execution verified",
      };
    } else {
      const unresolvedCount = this.state.faults.filter((f) => !f.resolved).length;
      if (unresolvedCount === 0) {
        recoveryClaim = {
          status: "SUPPORTED",
          evidence: `All ${this.state.faults.length} injected fault(s) resolved via targeted recovery at affected boundaries`,
        };
      } else {
        recoveryClaim = {
          status: "FALSIFIED",
          evidence: `${unresolvedCount}/${this.state.faults.length} fault(s) remain unresolved`,
        };
      }
    }

    // 4. Mechanism necessity
    const isThin = this.state.candidate === "thin baseline";
    const necessitySupported = isThin
      ? this.state.features.length === 0
      : this.state.features.length === KERNEL_FEATURE_NAMES.length;
    const necessityClaim = {
      status: necessitySupported ? ("SUPPORTED" as const) : ("FALSIFIED" as const),
      evidence: necessitySupported
        ? isThin
          ? "Thin baseline retained 0 kernel mechanisms"
          : "Every retained mechanism is linked to one observed trigger and executable necessity criterion"
        : "Unneeded mechanisms survived trimming or triggers were unobserved",
    };

    // 5. Deletion discipline
    const deletionSupported = isThin
      ? this.state.features.length === 0
      : this.state.lifecycle &&
        this.state.features.length === KERNEL_FEATURE_NAMES.length;
    const deletionClaim = {
      status: deletionSupported ? ("SUPPORTED" as const) : ("FALSIFIED" as const),
      evidence: isThin
        ? "Kernel mechanisms trimmed to 0 when thin baseline satisfied all hard invariants"
        : "Kernel deletion rule recorded in lifecycle record; unneeded mechanisms trimmed",
    };

    const overallPassed =
      fadedClaim.status === "SUPPORTED" &&
      transferClaim.status === "SUPPORTED" &&
      recoveryClaim.status !== "FALSIFIED" &&
      necessityClaim.status === "SUPPORTED" &&
      deletionClaim.status === "SUPPORTED";

    return {
      overallPassed,
      claims: {
        faded_performance: fadedClaim,
        structural_transfer: transferClaim,
        targeted_recovery: recoveryClaim,
        mechanism_necessity: necessityClaim,
        deletion_discipline: deletionClaim,
      },
    };
  }

  public runPrototypeSelfCheck(): HarnessSelfCheckResult {
    // 1. Full recovered path
    const s1 = new HarnessTeachingSession();
    s1.startTask("cross-session");
    s1.pinSources();
    s1.defineOutcomeRequirements();
    s1.assignOwnership();
    s1.testBaseline();
    s1.selectCandidate("minimal neutral kernel");
    s1.applyTriggeredMechanisms();
    s1.defineArtifactContract();
    s1.injectAmbiguousEffect();
    s1.recoverAmbiguousEffect();
    s1.evaluateLifecycleFixtures();
    s1.recordLifecycleGuidance();
    s1.answerSelfExplanation();
    s1.completeFadedCase();
    s1.routeTransferCase();
    const r1 = s1.attemptCompletion();
    if (r1.status !== "independent") {
      return {
        passed: false,
        pathsPassed: 0,
        message: `Full recovered path failed: got ${r1.status}`,
      };
    }

    // 2. Thin baseline path
    const s2 = new HarnessTeachingSession();
    s2.startTask("single-session");
    s2.pinSources();
    s2.defineOutcomeRequirements();
    s2.assignOwnership();
    s2.testBaseline();
    s2.selectCandidate("thin baseline");
    s2.applyTriggeredMechanisms([]);
    s2.defineArtifactContract();
    s2.evaluateLifecycleFixtures();
    s2.recordLifecycleGuidance();
    s2.answerSelfExplanation();
    s2.completeFadedCase();
    s2.routeTransferCase();
    const r2 = s2.attemptCompletion();
    if (r2.status !== "trimmed") {
      return {
        passed: false,
        pathsPassed: 1,
        message: `Thin baseline path failed: got ${r2.status}`,
      };
    }

    // 3. Shadow owner state path
    const s3 = new HarnessTeachingSession();
    s3.startTask("cross-session");
    s3.pinSources();
    s3.defineOutcomeRequirements();
    s3.assignOwnership();
    s3.testBaseline();
    s3.selectCandidate("minimal neutral kernel");
    s3.applyTriggeredMechanisms();
    s3.defineArtifactContract();
    s3.injectAmbiguousEffect();
    s3.recoverAmbiguousEffect();
    s3.evaluateLifecycleFixtures();
    s3.recordLifecycleGuidance();
    s3.answerSelfExplanation();
    s3.completeFadedCase();
    s3.routeTransferCase();
    s3.injectShadowState();
    const r3 = s3.attemptCompletion();
    if (r3.status !== "rejected") {
      return {
        passed: false,
        pathsPassed: 2,
        message: `Shadow state path failed to reject: got ${r3.status}`,
      };
    }

    // 4. Duplicate replay path
    const s4 = new HarnessTeachingSession();
    s4.startTask("cross-session");
    s4.pinSources();
    s4.defineOutcomeRequirements();
    s4.assignOwnership();
    s4.testBaseline();
    s4.selectCandidate("minimal neutral kernel");
    s4.applyTriggeredMechanisms();
    s4.defineArtifactContract();
    s4.injectAmbiguousEffect();
    s4.injectDuplicateReplay();
    s4.evaluateLifecycleFixtures();
    s4.recordLifecycleGuidance();
    s4.answerSelfExplanation();
    s4.completeFadedCase();
    s4.routeTransferCase();
    const r4 = s4.attemptCompletion();
    if (r4.status !== "rejected") {
      return {
        passed: false,
        pathsPassed: 3,
        message: `Duplicate replay path failed to reject: got ${r4.status}`,
      };
    }

    // 5. Pin drift path
    const s5 = new HarnessTeachingSession();
    s5.startTask("cross-session");
    s5.pinSources();
    s5.defineOutcomeRequirements();
    s5.assignOwnership();
    s5.testBaseline();
    s5.selectCandidate("minimal neutral kernel");
    s5.applyTriggeredMechanisms();
    s5.defineArtifactContract();
    s5.injectAmbiguousEffect();
    s5.recoverAmbiguousEffect();
    s5.evaluateLifecycleFixtures();
    s5.recordLifecycleGuidance();
    s5.answerSelfExplanation();
    s5.completeFadedCase();
    s5.routeTransferCase();
    s5.injectPinDrift();
    const r5 = s5.attemptCompletion();
    if (r5.status !== "rejected") {
      return {
        passed: false,
        pathsPassed: 4,
        message: `Pin drift path failed to reject: got ${r5.status}`,
      };
    }

    // 6. Runtime recursion path
    const s6 = new HarnessTeachingSession();
    s6.startTask("cross-session");
    s6.pinSources();
    s6.defineOutcomeRequirements();
    s6.assignOwnership();
    s6.testBaseline();
    s6.selectCandidate("minimal neutral kernel");
    s6.applyTriggeredMechanisms();
    s6.defineArtifactContract();
    s6.injectAmbiguousEffect();
    s6.recoverAmbiguousEffect();
    s6.evaluateLifecycleFixtures();
    s6.recordLifecycleGuidance();
    s6.answerSelfExplanation();
    s6.completeFadedCase();
    s6.routeTransferCase();
    s6.injectRuntimeRecursion();
    const r6 = s6.attemptCompletion();
    if (r6.status !== "rejected") {
      return {
        passed: false,
        pathsPassed: 5,
        message: `Runtime recursion path failed to reject: got ${r6.status}`,
      };
    }

    return {
      passed: true,
      pathsPassed: 6,
      message: "6 deterministic paths passed",
    };
  }
}
