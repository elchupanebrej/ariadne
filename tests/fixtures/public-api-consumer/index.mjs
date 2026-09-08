import {
  AriadneEpistemicEnvelopeSchema,
  AriadneError,
  EDGE_TYPES,
  EdgeSchema,
  EdgeTypeSchema,
  EpistemicGateEngine,
  EpistemicGraph,
  MethodContractSchema,
  NODE_TYPES,
  NodeIdSchema,
  NodeSchema,
  NodeSchemas,
  NodeTypeSchema,
  PROVENANCE_TYPES,
  ProvenanceTypeSchema,
  StateSchema,
  TRANSITION_LIFECYCLE,
  TransitionLifecycleSchema,
  checkProfileCompletion,
  exportEnvelopeJsonSchema,
  resolveMethodContract,
  resolveProfile,
  runCli,
  validateMethodContract,
} from "ariadne-reasoning";
import * as publicApi from "ariadne-reasoning";

const expectedRuntimeValues = [
  "AriadneEpistemicEnvelopeSchema",
  "AriadneError",
  "EDGE_TYPES",
  "EdgeSchema",
  "EdgeTypeSchema",
  "EpistemicGateEngine",
  "EpistemicGraph",
  "MethodContractSchema",
  "NODE_TYPES",
  "NodeIdSchema",
  "NodeSchema",
  "NodeSchemas",
  "NodeTypeSchema",
  "PROVENANCE_TYPES",
  "ProvenanceTypeSchema",
  "StateSchema",
  "TRANSITION_LIFECYCLE",
  "TransitionLifecycleSchema",
  "checkProfileCompletion",
  "exportEnvelopeJsonSchema",
  "resolveMethodContract",
  "resolveProfile",
  "runCli",
  "validateMethodContract",
].sort();

const actualRuntimeValues = Object.keys(publicApi).sort();
if (JSON.stringify(actualRuntimeValues) !== JSON.stringify(expectedRuntimeValues)) {
  throw new Error(
    `Unexpected root runtime exports: ${JSON.stringify(actualRuntimeValues)}`,
  );
}

for (const [name, value] of Object.entries({
  AriadneEpistemicEnvelopeSchema,
  AriadneError,
  EdgeSchema,
  EdgeTypeSchema,
  EpistemicGateEngine,
  EpistemicGraph,
  MethodContractSchema,
  NodeIdSchema,
  NodeSchema,
  NodeSchemas,
  NodeTypeSchema,
  ProvenanceTypeSchema,
  StateSchema,
  TransitionLifecycleSchema,
  checkProfileCompletion,
  exportEnvelopeJsonSchema,
  resolveMethodContract,
  resolveProfile,
  runCli,
  validateMethodContract,
})) {
  if (typeof value !== "function" && typeof value !== "object") {
    throw new Error(`Public runtime export ${name} has an invalid value`);
  }
}

if (NODE_TYPES.length === 0 || PROVENANCE_TYPES.length === 0 ||
    TRANSITION_LIFECYCLE.length === 0 || EDGE_TYPES.length === 0) {
  throw new Error("Public vocabulary exports are empty");
}

const error = new AriadneError({
  code: "INVALID_INPUT",
  message: "clean consumer contract check",
});
if (error.code !== "INVALID_INPUT") {
  throw new Error("AriadneError did not preserve its diagnostic code");
}

try {
  await import("ariadne-reasoning/dist/index.js");
  throw new Error("A package subpath unexpectedly resolved");
} catch (error) {
  if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
}

for (const removed of [
  "FileStorageDriver",
  "StorageDriver",
  "GraphStorage",
  "runInit",
  "WorktreeManager",
  "AriadneHarnessController",
]) {
  if (removed in publicApi) throw new Error(`Internal export leaked: ${removed}`);
}

console.log("Public API clean consumer verified successfully");
