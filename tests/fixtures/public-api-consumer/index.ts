import {
  AriadneError,
  EpistemicGateEngine,
  EpistemicGraph,
  runCli,
} from "ariadne-reasoning";
import type {
  AriadneEpistemicEnvelope,
  AriadneState,
  DiagnosticCode,
  DiagnosticPayload,
  EdgeFilter,
  EdgeType,
  EpistemicEdge,
  GateCommand,
  GateDiagnostic,
  GateName,
  GateReceipt,
  GateResult,
  GateVerificationOptions,
  InvalidationTraceEntry,
  MaterializedGraph,
  MethodContract,
  MethodContractPin,
  MethodContractValidationResult,
  Node,
  NodeFilter,
  NodeId,
  NodeType,
  ProfileCompletionResult,
  ProfileCompletionState,
  ProvenanceType,
  ReportOptions,
  ReportOutput,
  ReportSummary,
  ResolvedProfile,
  RunCliOptions,
  TransitionLifecycle,
  ValidateMethodContractOptions,
} from "ariadne-reasoning";

type PublicTypeSmoke = {
  envelope: AriadneEpistemicEnvelope;
  state: AriadneState;
  diagnosticCode: DiagnosticCode;
  diagnosticPayload: DiagnosticPayload;
  edgeFilter: EdgeFilter;
  edgeType: EdgeType;
  edge: EpistemicEdge;
  gateCommand: GateCommand;
  gateDiagnostic: GateDiagnostic;
  gateName: GateName;
  gateReceipt: GateReceipt;
  gateResult: GateResult;
  gateOptions: GateVerificationOptions;
  invalidation: InvalidationTraceEntry;
  graph: MaterializedGraph;
  contract: MethodContract;
  pin: MethodContractPin;
  validation: MethodContractValidationResult;
  node: Node;
  nodeFilter: NodeFilter;
  nodeId: NodeId;
  nodeType: NodeType;
  profileResult: ProfileCompletionResult;
  profileState: ProfileCompletionState;
  provenanceType: ProvenanceType;
  reportOptions: ReportOptions;
  reportOutput: ReportOutput;
  reportSummary: ReportSummary;
  resolvedProfile: ResolvedProfile;
  cliOptions: RunCliOptions;
  lifecycle: TransitionLifecycle;
  validateOptions: ValidateMethodContractOptions;
};

const publicTypesResolve: PublicTypeSmoke | undefined = undefined;
void publicTypesResolve;
void EpistemicGateEngine;
void EpistemicGraph;
void AriadneError;
void runCli;
