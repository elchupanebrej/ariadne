import type {
  A0WorkingMap,
  A1MethodologyProfile,
  A2RationaleRegister,
  A3UserMap,
  A4DecisionMap,
  A5LearningModule,
  A6VerificationProtocol,
  A7LifecycleLog,
  MethodDeclaredInputManifest,
  MethodTeachingPhase,
  MethodTeachingState,
  MethodTeachingStatus,
  PrototypeSelfCheckResult,
} from "./types.js";
import {
  createDefaultDeclaredManifest,
  createDefaultGuideProject,
} from "./verifier.js";

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
      recoveryPracticed: false,
      brokenLink: false,
      shadowContract: false,
      circularProof: false,
      lastMessage: "No guide-authoring task has been presented.",
      manifest: manifest || createDefaultDeclaredManifest(),
      prohibitedInputsDetected: [],
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

  public recordExternalVerification(receipts?: Record<string, string>): {
    success: boolean;
    message: string;
  } {
    if (this.state.brokenLink || this.state.links.length !== RATIONALE_LINKS.length) {
      return {
        success: false,
        message: "Repair traceability before external verification.",
      };
    }
    if (!this.state.artifacts.A6) {
      return {
        success: false,
        message: "A6 must define the external verification protocol.",
      };
    }

    this.state.externalReceipt = true;
    this.state.phase = "externally_verified";
    this.state.lastMessage =
      "Recorded separate expert-review, novice task-performance, and pilot-decision owner receipts; none came from self-application.";
    return { success: true, message: this.state.lastMessage };
  }

  public submitSelfExplanation(answers?: Record<string, string>): {
    success: boolean;
    message: string;
  } {
    if (!this.state.externalReceipt) {
      return {
        success: false,
        message: "Finish the complete worked project before self-explanation.",
      };
    }
    this.state.selfExplanation = true;
    this.state.phase = "explained";
    this.state.lastMessage =
      "Explained why each A1-A7 expansion fired, why A0 stayed concise, and why an owner receipt cannot be inferred from prose.";
    return { success: true, message: this.state.lastMessage };
  }

  public completeFadedCase(): { success: boolean; message: string } {
    if (!this.state.selfExplanation) {
      return {
        success: false,
        message: "Explain the worked example before fading support.",
      };
    }
    this.state.fadedCase = true;
    this.state.phase = "faded_practice";
    this.state.lastMessage =
      "Completed a partially supplied incident-handoff guide project with expansion reasons, trace links, and receipts withheld.";
    return { success: true, message: this.state.lastMessage };
  }

  public routeTransferCase(): { success: boolean; message: string } {
    if (!this.state.fadedCase) {
      return {
        success: false,
        message: "Complete the faded case first.",
      };
    }
    this.state.transferCase = true;
    this.state.selfConsistencyReceipt = true;
    this.state.selfConsistencySeparated = true;
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
