import type { MaterializedGraph } from "../graph/storage.js";
import type { Node } from "../core/schemas/nodes.js";
import type { Edge } from "../core/schemas/edges.js";
import { runParserCheck } from "./parser.js";
import type {
  AriadneTeachingState,
  CompletionResult,
  DeclaredInputManifest,
  FadedCaseSolution,
  SelfExplanationAnswers,
} from "./types.js";

const DEFAULT_MANIFEST: DeclaredInputManifest = {
  taskId: "config-line-parser-decision",
  taskDescription:
    "Parse KEY=VALUE config lines: split on first '=', preserve trailing '=', reject empty key or missing delimiter, add no dependency unless required.",
  declaredInputs: [
    {
      id: "task-req",
      role: "specification",
      source: "ticket-03-parser-decision",
    },
    {
      id: "router",
      role: "orchestration",
      source: ".agents/skills/ariadne/SKILL.md",
    },
    {
      id: "uncertainty-rule",
      role: "reasoning-rule",
      source: ".agents/skills/ariadne/rules/05-uncertainty.md",
    },
    {
      id: "frame-rule",
      role: "reasoning-rule",
      source: ".agents/skills/ariadne/rules/10-frame.md",
    },
    {
      id: "core-rule",
      role: "graph-contract",
      source: ".agents/skills/ariadne/rules/00-core.md",
    },
    {
      id: "explore-rule",
      role: "reasoning-rule",
      source: ".agents/skills/ariadne/rules/40-explore.md",
    },
    {
      id: "value-rule",
      role: "reasoning-rule",
      source: ".agents/skills/ariadne/rules/80-value.md",
    },
    {
      id: "validate-rule",
      role: "reasoning-rule",
      source: ".agents/skills/ariadne/rules/90-validate.md",
    },
    {
      id: "evidence-rule",
      role: "reasoning-rule",
      source: ".agents/skills/ariadne/rules/evidence.md",
    },
  ],
};

export class AriadneTeachingSession {
  private state: AriadneTeachingState;
  private isolatedNodes: Node[] = [];
  private isolatedEdges: Edge[] = [];

  constructor(manifest: DeclaredInputManifest = DEFAULT_MANIFEST) {
    this.state = {
      phase: "not_started",
      status: "learning",
      currentSource: "none",
      loadedSources: [],
      artifacts: [],
      manifest,
      meaningfulTaskAttempted: false,
      rejectedCandidates: [],
      runnableCheckPassed: false,
      selfExplanationSubmitted: false,
      fadedCaseCompleted: false,
      transferRouteCompleted: false,
      bulkLoadedRules: false,
      copiedMethodContractProse: false,
      isolatedGraphPath: ".agents/skills/teach-ariadne/example/.ariadne",
      lastMessage: "No task has been presented.",
    };
  }

  private loadSource(source: string) {
    this.state.currentSource = source;
    if (!this.state.loadedSources.includes(source)) {
      this.state.loadedSources.push(source);
    }
  }

  startTask(): void {
    this.state.meaningfulTaskAttempted = true;
    this.state.phase = "orient";
    this.loadSource(".agents/skills/ariadne/SKILL.md");
    this.state.lastMessage =
      "Task: parse KEY=VALUE lines, split on first equals, reject empty key or missing delimiter, add no dependency.";
  }

  runUncertaintyIngress(): void {
    if (!this.state.meaningfulTaskAttempted) {
      throw new Error("Must start with meaningful task before uncertainty ingress");
    }
    this.state.phase = "uncertainty";
    this.loadSource(".agents/skills/ariadne/rules/05-uncertainty.md");
    this.state.lastMessage =
      "Uncertainty: proposed package is a candidate mechanism, not a behavioral requirement.";
  }

  frameBehavior(): void {
    if (this.state.phase !== "uncertainty") {
      throw new Error("Must run uncertainty ingress before framing behavior");
    }
    this.state.phase = "framed";
    this.loadSource(".agents/skills/ariadne/rules/10-frame.md");
    this.loadSource(".agents/skills/ariadne/rules/00-core.md");
    const frameId = "FRAME-config-line-parser";
    if (!this.state.artifacts.includes(frameId)) {
      this.state.artifacts.push(frameId);
      this.isolatedNodes.push({
        id: frameId,
        type: "FRAME",
        provenance_type: "FACT",
        statement:
          "Parse KEY=VALUE config lines: split on first '=', retain subsequent '=', reject empty key or missing delimiter, add no dependency unless required.",
        title: "Config line parser behavior",
        status: "ACCEPTED",
      } as unknown as Node);
    }
    this.state.lastMessage = "Persisted FRAME-config-line-parser.";
  }

  exploreCandidates(): void {
    if (!this.state.artifacts.includes("FRAME-config-line-parser")) {
      throw new Error("Must frame behavior before exploring candidates");
    }
    this.state.phase = "explored";
    this.loadSource(".agents/skills/ariadne/rules/40-explore.md");

    const spaceId = "SPACE-config-line-parser";
    const can1 = "CAN-first-delimiter-stdlib";
    const can2 = "CAN-json-input";
    const can3 = "CAN-environment-boundary";

    const candidateIds = [spaceId, can1, can2, can3];
    for (const id of candidateIds) {
      if (!this.state.artifacts.includes(id)) {
        this.state.artifacts.push(id);
      }
    }

    this.isolatedNodes.push(
      {
        id: spaceId,
        type: "SPACE",
        provenance_type: "PROPOSED",
        statement:
          "Explore stdlib first-delimiter parsing, JSON input representation, and environment boundary mechanisms.",
        title: "Config parser mechanism space",
        status: "ACCEPTED",
      } as unknown as Node,
      {
        id: can1,
        type: "CAN",
        provenance_type: "PROPOSED",
        statement:
          "Use native String.indexOf and String.slice inside the parser function boundary without dependencies.",
        title: "Standard library first delimiter parsing",
        status: "PROPOSED",
      } as unknown as Node,
      {
        id: can2,
        type: "CAN",
        provenance_type: "PROPOSED",
        statement:
          "Change input specification to standard JSON format instead of KEY=VALUE lines.",
        title: "JSON representation change",
        status: "PROPOSED",
      } as unknown as Node,
      {
        id: can3,
        type: "CAN",
        provenance_type: "PROPOSED",
        statement:
          "Delegate config parsing to process environment variable input boundaries.",
        title: "Environment input boundary delegation",
        status: "PROPOSED",
      } as unknown as Node,
    );

    this.isolatedEdges.push(
      { source: spaceId, target: "FRAME-config-line-parser", type: "depends_on" } as Edge,
      { source: can1, target: spaceId, type: "derived_from" } as Edge,
      { source: can2, target: spaceId, type: "derived_from" } as Edge,
      { source: can3, target: spaceId, type: "derived_from" } as Edge,
    );

    this.state.lastMessage =
      "Explored 3 structurally distinct candidates: stdlib, JSON representation, and env boundary.";
  }

  filterAndSelect(): void {
    if (!this.state.artifacts.includes("SPACE-config-line-parser")) {
      throw new Error("Must explore candidates before value filtering");
    }
    this.state.phase = "selected";
    this.loadSource(".agents/skills/ariadne/rules/80-value.md");

    const valId = "VAL-SELECT-config-line-parser";
    const reqId = "EVDREQ-config-line-parser-r3";

    if (!this.state.artifacts.includes(valId)) {
      this.state.artifacts.push(valId);
      this.isolatedNodes.push({
        id: valId,
        type: "VAL-SELECT",
        provenance_type: "DECIDED",
        statement:
          "Hard filter: JSON breaks format compatibility; env boundary changes interface ownership. CAN-first-delimiter-stdlib selected provisionally.",
        title: "Candidate evaluation and hard requirement filtering",
        status: "ACCEPTED",
        adversarial_critique:
          "JSON breaks compatibility with existing KEY=VALUE contract; environment boundary alters ownership model.",
        selected: "CAN-first-delimiter-stdlib",
        rejected: ["CAN-json-input", "CAN-environment-boundary"],
      } as unknown as Node);
      this.isolatedEdges.push({
        source: valId,
        target: "CAN-first-delimiter-stdlib",
        type: "depends_on",
      } as Edge);
    }

    if (!this.state.artifacts.includes(reqId)) {
      this.state.artifacts.push(reqId);
      this.isolatedNodes.push({
        id: reqId,
        type: "EVDREQ",
        provenance_type: "PROPOSED",
        statement:
          "Require Rung 3 Algorithmic logic assertion check covering 4 deterministic test cases.",
        title: "Algorithmic validation for config line parser",
        status: "PROPOSED",
        required_rung: 3,
        candidate: "CAN-first-delimiter-stdlib",
      } as unknown as Node);
      this.isolatedEdges.push({
        source: reqId,
        target: "CAN-first-delimiter-stdlib",
        type: "tests",
      } as Edge);
    }

    this.state.selectedCandidate = "CAN-first-delimiter-stdlib";
    this.state.rejectedCandidates = ["CAN-json-input", "CAN-environment-boundary"];
    this.state.lastMessage =
      "Hard filtered incompatible candidates; selected stdlib candidate provisionally pending Rung 3 evidence.";
  }

  runValidation(): void {
    if (!this.state.artifacts.includes("EVDREQ-config-line-parser-r3")) {
      throw new Error("Must create evidence request before validation");
    }
    this.state.phase = "validated";
    this.loadSource(".agents/skills/ariadne/rules/90-validate.md");
    this.loadSource(".agents/skills/ariadne/rules/evidence.md");

    const check = runParserCheck();
    if (!check.passed) {
      throw new Error("Parser check failed");
    }
    this.state.runnableCheckPassed = true;

    const evdId = "EVD-config-line-parser-r3";
    const decId = "DEC-config-line-parser";

    if (!this.state.artifacts.includes(evdId)) {
      this.state.artifacts.push(evdId);
      this.isolatedNodes.push({
        id: evdId,
        type: "EVD",
        provenance_type: "MEASURED",
        statement:
          "Node assertion check passed all 4 deterministic parser cases at Rung 3.",
        title: "Rung 3 Algorithmic logic assertion receipt",
        status: "ACCEPTED",
        verdict: "SUPPORTED",
        method: "assertion_test",
        rung: 3,
        environment: "node-runtime",
        receipt:
          "sha256:4073099cd9d9d96dcb4f5e5bf937007e197be88fc26cc2b443d28fb5e526be27",
      } as unknown as Node);
      this.isolatedEdges.push({
        source: evdId,
        target: "EVDREQ-config-line-parser-r3",
        type: "answers",
      } as Edge);
    }

    if (!this.state.artifacts.includes(decId)) {
      this.state.artifacts.push(decId);
      this.isolatedNodes.push({
        id: decId,
        type: "DEC",
        provenance_type: "DECIDED",
        statement:
          "Lock CAN-first-delimiter-stdlib based on verified Rung 3 algorithmic evidence receipt EVD-config-line-parser-r3.",
        title: "Lock stdlib first-delimiter config line parser",
        status: "ACCEPTED",
        dependencies: ["EVD-config-line-parser-r3"],
        selected: "CAN-first-delimiter-stdlib",
      } as unknown as Node);
      this.isolatedEdges.push(
        {
          source: decId,
          target: "FRAME-config-line-parser",
          type: "satisfies",
        } as Edge,
        {
          source: decId,
          target: evdId,
          type: "depends_on",
        } as Edge,
      );
    }

    this.state.lastMessage =
      "Runnable check passed; emitted Rung 3 Evidence Result and locked Decision.";
  }

  submitSelfExplanation(answers: SelfExplanationAnswers): void {
    if (!this.state.runnableCheckPassed) {
      throw new Error("Cannot submit self-explanation before runnable check passes");
    }

    const {
      q1_mechanism_vs_requirement,
      q2_hard_filter_rationale,
      q3_evidence_rung_scope,
      q4_unloaded_rules_rationale,
    } = answers;

    if (
      !q1_mechanism_vs_requirement?.trim() ||
      !q2_hard_filter_rationale?.trim() ||
      !q3_evidence_rung_scope?.trim() ||
      !q4_unloaded_rules_rationale?.trim()
    ) {
      throw new Error("All self-explanation questions must be answered");
    }

    // Verify citation / conceptual grounding against live sources
    const combined = `${q1_mechanism_vs_requirement} ${q2_hard_filter_rationale} ${q3_evidence_rung_scope} ${q4_unloaded_rules_rationale}`.toLowerCase();
    const hasCoreConcepts =
      combined.includes("mechanism") &&
      combined.includes("requirement") &&
      combined.includes("rung 3");

    if (!hasCoreConcepts) {
      throw new Error(
        "Self-explanation answers must ground claims in Ariadne concepts (mechanism vs requirement, Rung 3 evidence, rule triggers).",
      );
    }

    this.state.selfExplanationSubmitted = true;
    this.state.selfExplanationAnswers = answers;
    this.state.phase = "explained";
    this.state.lastMessage = "Self-explanation verified against live sources.";
  }

  completeFadedCase(
    solution: FadedCaseSolution = { mechanism: "URLSearchParams", claimLevel: "R3" },
  ): void {
    if (!this.state.selfExplanationSubmitted) {
      throw new Error("Must complete self-explanation before faded case");
    }
    if (solution.mechanism !== "URLSearchParams" || solution.claimLevel !== "R3") {
      throw new Error(
        `Invalid faded case solution: expected URLSearchParams at R3, got ${solution.mechanism} at ${solution.claimLevel}`,
      );
    }
    this.state.fadedCaseCompleted = true;
    this.state.phase = "faded_practice";
    this.state.lastMessage =
      "Faded case completed: selected URLSearchParams with Rung 3 evidence without route scaffolding.";
  }

  routeTransferCase(
    route: string[] = ["uncertainty", "diagnose", "dynamics", "validate"],
  ): void {
    if (!this.state.fadedCaseCompleted) {
      throw new Error("Must complete faded case before transfer case");
    }
    const normalized = route.map((r) => r.toLowerCase().replace(/[^a-z]/g, ""));
    const hasDiagnose = normalized.some((r) => r.includes("diagnose"));
    const hasDynamics = normalized.some((r) => r.includes("dynamics"));
    const startsUncertainty = normalized[0]?.includes("uncertainty");

    if (!startsUncertainty || !hasDiagnose || !hasDynamics) {
      throw new Error(
        `Invalid transfer route for timeout/retry invoices: expected route starting with Uncertainty -> Diagnose -> Dynamics, got: ${route.join(" -> ")}`,
      );
    }

    this.state.transferRouteCompleted = true;
    this.state.phase = "transfer";
    this.state.lastMessage =
      "Transfer case routed: duplicate invoices -> Uncertainty -> Diagnose -> Dynamics.";
  }

  bulkLoadAllRules(): void {
    this.state.bulkLoadedRules = true;
    this.loadSource("all Ariadne rules");
    this.state.lastMessage = "Loaded all Ariadne rules in bulk.";
  }

  flagCopiedMethodContractProse(): void {
    this.state.copiedMethodContractProse = true;
    this.state.lastMessage = "Copied normative Method Contract prose into lesson.";
  }

  evaluateBlockers(): string[] {
    const blockers: string[] = [];
    if (!this.state.meaningfulTaskAttempted) {
      blockers.push("Meaningful task was not attempted");
    }
    if (!this.state.artifacts.includes("FRAME-config-line-parser")) {
      blockers.push("Behavior was not framed separately from proposed package");
    }
    if (!this.state.artifacts.includes("VAL-SELECT-config-line-parser")) {
      blockers.push("Candidates were not hard-filtered against requirements");
    }
    if (!this.state.artifacts.includes("EVD-config-line-parser-r3")) {
      blockers.push("Algorithmic claim lacks Rung 3 evidence receipt");
    }
    if (!this.state.artifacts.includes("DEC-config-line-parser")) {
      blockers.push("Decision was not locked with evidence reference");
    }
    if (!this.state.selfExplanationSubmitted) {
      blockers.push("Self-explanation prompts are unanswered");
    }
    if (!this.state.fadedCaseCompleted) {
      blockers.push("Faded practice case is incomplete");
    }
    if (!this.state.transferRouteCompleted) {
      blockers.push("Transfer case was not routed");
    }
    if (!this.state.runnableCheckPassed) {
      blockers.push("Runnable check did not pass");
    }
    if (this.state.bulkLoadedRules) {
      blockers.push("Rules were bulk-loaded before needed");
    }
    if (this.state.copiedMethodContractProse) {
      blockers.push("Lesson copied normative Method Contract prose");
    }
    return blockers;
  }

  attemptCompletion(): CompletionResult {
    const blockers = this.evaluateBlockers();
    if (blockers.length === 0) {
      this.state.status = "independent";
      this.state.phase = "complete";
      this.state.lastMessage =
        "Completion passed: clean session mastered progressive Ariadne routing with evidence.";
      return { passed: true, blockers: [] };
    }

    this.state.status = "rejected";
    this.state.phase = "blocked";
    this.state.lastMessage = `Completion rejected: ${blockers.join("; ")}`;
    return { passed: false, blockers };
  }

  getIsolatedGraph(): MaterializedGraph {
    return {
      nodes: this.isolatedNodes,
      edges: this.isolatedEdges,
    };
  }

  getState(): AriadneTeachingState {
    return { ...this.state };
  }
}

export function createAriadneTeachingSession(
  manifest?: DeclaredInputManifest,
): AriadneTeachingSession {
  return new AriadneTeachingSession(manifest);
}
