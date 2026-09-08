import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as publicApi from "../../src/index.js";
import { runCli } from "../../src/cli/index.js";

const capture = () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  return { stream, text: () => output };
};

const invoke = async (args: string[], cwd?: string) => {
  const stdout = capture();
  const stderr = capture();
  const dir = cwd ?? mkdtempSync(join(tmpdir(), "ariadne-public-api-"));
  const code = await runCli(args, {
    cwd: dir,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  return {
    code,
    stdout: stdout.text(),
    stderr: stderr.text(),
    cwd: dir,
  };
};

describe("Public API Surface Reset (src/index.ts)", () => {
  const EXPECTED_RUNTIME_VALUES = [
    // Schemas & Vocabularies
    "NODE_TYPES",
    "PROVENANCE_TYPES",
    "TRANSITION_LIFECYCLE",
    "NodeIdSchema",
    "NodeTypeSchema",
    "ProvenanceTypeSchema",
    "TransitionLifecycleSchema",
    "NodeSchemas",
    "NodeSchema",
    "EDGE_TYPES",
    "EdgeTypeSchema",
    "EdgeSchema",
    "AriadneEpistemicEnvelopeSchema",
    "exportEnvelopeJsonSchema",
    "StateSchema",
    // Deep Module Classes
    "EpistemicGraph",
    "EpistemicGateEngine",
    // Method Contract & Profile Utilities
    "MethodContractSchema",
    "validateMethodContract",
    "resolveMethodContract",
    "resolveProfile",
    "checkProfileCompletion",
    // CLI Embedding Seam
    "runCli",
    // Unified Error Class
    "AriadneError",
  ].sort();

  it("exports exactly the 24 public runtime values", () => {
    const exportedKeys = Object.keys(publicApi).sort();
    expect(exportedKeys).toEqual(EXPECTED_RUNTIME_VALUES);
    expect(exportedKeys.length).toBe(24);
  });

  it("exports runtime values with valid types and definitions", () => {
    // Vocabularies
    expect(Array.isArray(publicApi.NODE_TYPES)).toBe(true);
    expect(Array.isArray(publicApi.PROVENANCE_TYPES)).toBe(true);
    expect(Array.isArray(publicApi.TRANSITION_LIFECYCLE)).toBe(true);
    expect(Array.isArray(publicApi.EDGE_TYPES)).toBe(true);

    // Schemas
    expect(typeof publicApi.NodeIdSchema.parse).toBe("function");
    expect(typeof publicApi.NodeTypeSchema.parse).toBe("function");
    expect(typeof publicApi.ProvenanceTypeSchema.parse).toBe("function");
    expect(typeof publicApi.TransitionLifecycleSchema.parse).toBe("function");
    expect(typeof publicApi.NodeSchemas).toBe("object");
    expect(typeof publicApi.NodeSchema.parse).toBe("function");
    expect(typeof publicApi.EdgeTypeSchema.parse).toBe("function");
    expect(typeof publicApi.EdgeSchema.parse).toBe("function");
    expect(typeof publicApi.AriadneEpistemicEnvelopeSchema.parse).toBe("function");
    expect(typeof publicApi.StateSchema.parse).toBe("function");
    expect(typeof publicApi.MethodContractSchema.parse).toBe("function");

    // Functions / Classes
    expect(typeof publicApi.exportEnvelopeJsonSchema).toBe("function");
    expect(typeof publicApi.EpistemicGraph).toBe("function");
    expect(typeof publicApi.EpistemicGateEngine).toBe("function");
    expect(typeof publicApi.validateMethodContract).toBe("function");
    expect(typeof publicApi.resolveMethodContract).toBe("function");
    expect(typeof publicApi.resolveProfile).toBe("function");
    expect(typeof publicApi.checkProfileCompletion).toBe("function");
    expect(typeof publicApi.runCli).toBe("function");
    expect(typeof publicApi.AriadneError).toBe("function");
  });

  it("does not leak internal storage drivers, command handlers, multiagent deltas, or adapters", () => {
    const api = publicApi as Record<string, unknown>;

    // Internal storage drivers
    expect(api.FileStorageDriver).toBeUndefined();
    expect(api.FileSystemStorageDriver).toBeUndefined();
    expect(api.JournalWriter).toBeUndefined();
    expect(api.LockManager).toBeUndefined();
    expect(api.InMemoryStorageDriver).toBeUndefined();
    expect(api.GraphStorage).toBeUndefined();
    expect(api.StorageDriver).toBeUndefined();

    // Internal CLI command handlers
    expect(api.runInit).toBeUndefined();
    expect(api.runGate).toBeUndefined();
    expect(api.runTemplate).toBeUndefined();
    expect(api.runNode).toBeUndefined();
    expect(api.runEdge).toBeUndefined();
    expect(api.runStatus).toBeUndefined();
    expect(api.runReport).toBeUndefined();
    expect(api.runViz).toBeUndefined();
    expect(api.runInvalidation).toBeUndefined();
    expect(api.runIngest).toBeUndefined();
    expect(api.runMigrate).toBeUndefined();
    expect(api.runMergeDriver).toBeUndefined();
    expect(api.runMergeResolve).toBeUndefined();
    expect(api.runMergeSetup).toBeUndefined();
    expect(api.runMergeDoctor).toBeUndefined();
    expect(api.runMergeCheck).toBeUndefined();
    expect(api.runMergeSync).toBeUndefined();

    // Removed commands
    expect(api.op).toBeUndefined();
    expect(api.runOp).toBeUndefined();
    expect(api.envelope).toBeUndefined();
    expect(api.runEnvelope).toBeUndefined();

    // Multiagent / worktree
    expect(api.createDelta).toBeUndefined();
    expect(api.applyDelta).toBeUndefined();
    expect(api.WorktreeManager).toBeUndefined();

    // Adapters
    expect(api.detectGsd).toBeUndefined();
    expect(api.emitOperationalNotice).toBeUndefined();
    expect(api.projectGsdToAriadne).toBeUndefined();
    expect(api.runGsdLifecycle).toBeUndefined();
    expect(api.runMattLifecycle).toBeUndefined();

    // Controllers
    expect(api.AriadneHarnessController).toBeUndefined();
    expect(api.createHarnessController).toBeUndefined();

    // Low-level helpers
    expect(api.validateGraph).toBeUndefined();
    expect(api.propagateInvalidation).toBeUndefined();
    expect(api.canonicalEdgeRelation).toBeUndefined();
  });
});

describe("Canonical 18 CLI Commands & Help Grammar", () => {
  const CANONICAL_COMMANDS = [
    "init",
    "status",
    "node",
    "edge",
    "invalidate",
    "gate",
    "verify",
    "ingest",
    "report",
    "viz",
    "template",
    "migrate",
    "merge-driver",
    "merge-resolve",
    "merge-setup",
    "merge-doctor",
    "merge-check",
    "merge-sync",
  ] as const;

  it("registers all 18 canonical commands in root help output", async () => {
    const result = await invoke(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");

    for (const cmd of CANONICAL_COMMANDS) {
      expect(result.stdout).toMatch(new RegExp(`\\bariadne ${cmd}\\b`));
    }
  });

  it("does not reference ariadne-reasoning binary in help text", async () => {
    const result = await invoke(["--help"]);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("ariadne-reasoning ");
    expect(result.stdout).not.toMatch(/\bariadne-reasoning\b/);
  });
});

describe("CLI Exit Status Code Harmonization (0/1/2)", () => {
  it("exits with 0 on help and version requests", async () => {
    const help1 = await invoke(["--help"]);
    expect(help1.code).toBe(0);

    const help2 = await invoke(["-h"]);
    expect(help2.code).toBe(0);

    const version1 = await invoke(["--version"]);
    expect(version1.code).toBe(0);

    const version2 = await invoke(["-v"]);
    expect(version2.code).toBe(0);

    const nodeHelp = await invoke(["node", "--help"]);
    expect(nodeHelp.code).toBe(0);

    const gateHelp = await invoke(["gate", "--help"]);
    expect(gateHelp.code).toBe(0);

    const verifyHelp = await invoke(["verify", "--help"]);
    expect(verifyHelp.code).toBe(0);
  });

  it("exits with 1 on negative domain verdicts (continuation)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ariadne-exit1-"));
    const initRes = await invoke(["init"], dir);
    expect(initRes.code).toBe(0);

    // Add a hypothesis without falsification conditions
    const addRes = await invoke(
      [
        "node",
        "add",
        "HYP",
        "HYP-1",
        "--title",
        "Unfalsifiable",
        "--payload",
        JSON.stringify({ statement: "A hypothesis without falsification conditions" }),
      ],
      dir,
    );
    expect(addRes.code).toBe(0);

    // Running a strict semantic gate fails -> exit 1
    const gateRes = await invoke(["gate", "semantic", "--strict"], dir);
    expect(gateRes.code).toBe(1);

    // Verify command also fails with negative domain verdict -> exit 1
    const verifyRes = await invoke(["verify", "--strict"], dir);
    expect(verifyRes.code).toBe(1);
  });

  it("exits with 2 on fatal infrastructure / validation / stop errors", async () => {
    // Unknown command
    const unknownCmd = await invoke(["invalid-command-xyz"]);
    expect(unknownCmd.code).toBe(2);
    expect(unknownCmd.stderr).toContain("INVALID_INPUT");

    // Legacy workspace mutation rejection (MIGRATION_REQUIRED)
    const dir = mkdtempSync(join(tmpdir(), "ariadne-exit2-"));
    const fs = await import("node:fs");
    fs.mkdirSync(join(dir, ".ariadne"));
    fs.writeFileSync(join(dir, ".ariadne", "GRAPH.jsonl"), "{\"kind\":\"node\",\"node\":{\"id\":\"TASK-1\"}}\n");
    fs.writeFileSync(join(dir, ".ariadne", "STATE.yaml"), "mode: standalone\n");

    const mutateRes = await invoke(["node", "add", "TASK", "TASK-2", "--title", "T", "--payload", "{}"], dir);
    expect(mutateRes.code).toBe(2);
    expect(mutateRes.stderr).toContain("MIGRATION_REQUIRED");
  });
});

describe("Declaration Completeness (dist/index.d.ts)", () => {
  const dtsPath = fileURLToPath(new URL("../../dist/index.d.ts", import.meta.url));

  it("contains strictly the 24 public types and 24 values", () => {
    if (!existsSync(dtsPath)) return;
    const content = readFileSync(dtsPath, "utf8");

    // 24 runtime values
    const expectedValues = [
      "NODE_TYPES",
      "PROVENANCE_TYPES",
      "TRANSITION_LIFECYCLE",
      "NodeIdSchema",
      "NodeTypeSchema",
      "ProvenanceTypeSchema",
      "TransitionLifecycleSchema",
      "NodeSchemas",
      "NodeSchema",
      "EDGE_TYPES",
      "EdgeTypeSchema",
      "EdgeSchema",
      "AriadneEpistemicEnvelopeSchema",
      "exportEnvelopeJsonSchema",
      "StateSchema",
      "EpistemicGraph",
      "EpistemicGateEngine",
      "MethodContractSchema",
      "validateMethodContract",
      "resolveMethodContract",
      "resolveProfile",
      "checkProfileCompletion",
      "runCli",
      "AriadneError",
    ];

    for (const val of expectedValues) {
      expect(content).toContain(val);
    }

    // 24 public types
    const expectedTypes = [
      "Node",
      "NodeId",
      "NodeType",
      "ProvenanceType",
      "TransitionLifecycle",
      "EdgeType",
      "EpistemicEdge",
      "AriadneEpistemicEnvelope",
      "AriadneState",
      "MaterializedGraph",
      "NodeFilter",
      "EdgeFilter",
      "InvalidationTraceEntry",
      "ReportOptions",
      "ReportOutput",
      "ReportSummary",
      "GateName",
      "GateCommand",
      "GateDiagnostic",
      "GateResult",
      "GateReceipt",
      "GateVerificationOptions",
      "MethodContract",
      "MethodContractPin",
    ];

    for (const type of expectedTypes) {
      expect(content).toContain(type);
    }

    // No internal modules or drivers leaked
    expect(content).not.toContain("FileStorageDriver");
    expect(content).not.toContain("JournalWriter");
    expect(content).not.toContain("LockManager");
    expect(content).not.toContain("runInit");
    expect(content).not.toContain("runGate");
    expect(content).not.toContain("WorktreeManager");
    expect(content).not.toContain("adapters");
  });
});
