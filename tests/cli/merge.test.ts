import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { mergeBranchModels } from "../../src/merge/three-way.js";

const run = promisify(execFile);
const git = async (cwd: string, ...args: string[]) => run("git", args, { cwd });
const gitPath = (path: string): string =>
  path.replaceAll("\\", "/");

const nodeEvent = (id: string): string =>
  JSON.stringify({
    kind: "node",
    node: { id, type: "TASK", provenance_type: "PROPOSED", statement: id },
  });

const edgeEvent = (source: string, target: string): string =>
  JSON.stringify({ kind: "edge", edge: { source, type: "depends_on", target } });

const edgeEventOf = (
  source: string,
  type: string,
  target: string,
  tombstone = false,
): string =>
  JSON.stringify({
    kind: "edge",
    edge: { source, type, target },
    ...(tombstone ? { tombstone: true } : {}),
  });

const typedNodeEvent = (
  id: string,
  type: string,
  statement = id,
  extra: Record<string, unknown> = {},
): string =>
  JSON.stringify({
    kind: "node",
    node: { id, type, provenance_type: "PROPOSED", statement, ...extra },
  });

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

const invoke = (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  return runCli(args, { cwd, stdout: stdout.stream, stderr: stderr.stream }).then((code) => ({
    code,
    stdout,
    stderr,
  }));
};

describe("ariadne merge-driver", () => {
  it("lets an ordinary Git merge combine independent branch model changes", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      await git(repo, "init", "-q");
      await git(repo, "config", "user.email", "test@example.com");
      await git(repo, "config", "user.name", "Ariadne Test");
      await writeFile(join(repo, ".gitattributes"), "GRAPH.jsonl merge=ariadne\n");
      await writeFile(
        join(repo, "GRAPH.jsonl"),
        `${nodeEvent("TASK-BASE")}\n${nodeEvent("TASK-TARGET")}\n`,
      );
      await git(repo, "add", ".gitattributes", "GRAPH.jsonl");
      await git(repo, "commit", "-qm", "base");

      const cliPath = gitPath(fileURLToPath(new URL("../../dist/cli/index.js", import.meta.url)));
      await git(
        repo,
        "config",
        "merge.ariadne.driver",
        `${gitPath(process.execPath)} ${cliPath} merge-driver %O %A %B`,
      );

      await git(repo, "checkout", "-qb", "current");
      await writeFile(
        join(repo, "GRAPH.jsonl"),
        `${nodeEvent("TASK-BASE")}\n${nodeEvent("TASK-TARGET")}\n${nodeEvent("TASK-CURRENT")}\n${edgeEvent("TASK-CURRENT", "TASK-TARGET")}\n`,
      );
      await git(repo, "add", "GRAPH.jsonl");
      await git(repo, "commit", "-qm", "current change");

      await git(repo, "checkout", "-qb", "incoming", "HEAD~1");
      await writeFile(
        join(repo, "GRAPH.jsonl"),
        `${nodeEvent("TASK-BASE")}\n${nodeEvent("TASK-TARGET")}\n${nodeEvent("TASK-INCOMING")}\n${edgeEvent("TASK-INCOMING", "TASK-TARGET")}\n`,
      );
      await git(repo, "add", "GRAPH.jsonl");
      await git(repo, "commit", "-qm", "incoming change");

      await git(repo, "checkout", "current");
      await git(repo, "merge", "incoming", "--no-edit");

      const base = `${nodeEvent("TASK-BASE")}\n${nodeEvent("TASK-TARGET")}\n`;
      const merged = await readFile(join(repo, "GRAPH.jsonl"), "utf8");
      expect(merged.slice(0, base.length)).toBe(base);
      expect(merged.split("\n").filter(Boolean).map((line) => JSON.parse(line))).toEqual([
        JSON.parse(nodeEvent("TASK-BASE")),
        JSON.parse(nodeEvent("TASK-TARGET")),
        JSON.parse(nodeEvent("TASK-CURRENT")),
        JSON.parse(nodeEvent("TASK-INCOMING")),
        JSON.parse(edgeEvent("TASK-CURRENT", "TASK-TARGET")),
        JSON.parse(edgeEvent("TASK-INCOMING", "TASK-TARGET")),
      ]);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);

  it("deduplicates canonical changes and applies a one-sided change", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const base = `${nodeEvent("TASK-BASE")}\n`;
      const same = nodeEvent("TASK-SAME");
      const reformatted = JSON.stringify({
        node: {
          statement: "TASK-SAME",
          provenance_type: "PROPOSED",
          type: "TASK",
          id: "TASK-SAME",
        },
        kind: "node",
      });
      await writeFile(basePath, base);
      await writeFile(currentPath, `${base}${same}\n${reformatted}\n`);
      await writeFile(incomingPath, `${base}${reformatted}\n`);

      const result = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);
      const receipt = JSON.parse(result.stdout.text()) as {
        outcome: string;
        applied_subjects: string[];
        deduplicated_subjects: string[];
      };
      expect(result.code).toBe(0);
      expect(receipt.outcome).toBe("CLEAN");
      expect(receipt.applied_subjects).toEqual(["TASK-SAME"]);
      expect(receipt.deduplicated_subjects).toEqual(["TASK-SAME"]);
      expect((await readFile(currentPath, "utf8")).split("\n").filter(Boolean)).toHaveLength(2);

      await writeFile(currentPath, `${base}${nodeEvent("TASK-CURRENT")}\n`);
      await writeFile(incomingPath, base);
      const oneSided = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);
      expect(oneSided.code).toBe(0);
      expect(JSON.parse(oneSided.stdout.text())).toMatchObject({
        outcome: "CLEAN",
        applied_subjects: ["TASK-CURRENT"],
        deduplicated_subjects: [],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("preserves divergent revisions as one graph-native merge contradiction", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const baseNode = JSON.parse(nodeEvent("TASK-SHARED"));
      const currentNode = {
        kind: "node",
        node: {
          ...baseNode.node,
          statement: "Current branch interpretation",
          provenance_type: "ASSUMED",
        },
      };
      const incomingNode = {
        kind: "node",
        node: {
          ...baseNode.node,
          statement: "Incoming branch interpretation",
          provenance_type: "MEASURED",
        },
      };
      const base = `${nodeEvent("TASK-SHARED")}\n`;
      await writeFile(basePath, base);
      await writeFile(currentPath, `${base}${JSON.stringify(currentNode)}\n`);
      await writeFile(incomingPath, `${base}${JSON.stringify(incomingNode)}\n`);

      const result = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);

      expect(result.code).toBe(0);
      const receipt = JSON.parse(result.stdout.text()) as {
        outcome: string;
        created_conflict_ids: string[];
      };
      expect(receipt.outcome).toBe("DIVERGED");
      expect(receipt.created_conflict_ids).toHaveLength(1);

      const mergedEvents = (await readFile(currentPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { kind: string; node?: Record<string, unknown> });
      expect(mergedEvents).toHaveLength(2);
      expect(mergedEvents[0]).toEqual(baseNode);
      const contradiction = mergedEvents[1].node as Record<string, unknown>;
      expect(contradiction).toMatchObject({
        type: "CTR",
        provenance_type: "FACT",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
        subject_key: "TASK-SHARED",
        base_value: baseNode.node,
      });
      expect(contradiction.id).toMatch(/^CTR-merge-/u);
      expect(contradiction.variants).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: currentNode.node, source_digest: expect.any(String) }),
          expect.objectContaining({ value: incomingNode.node, source_digest: expect.any(String) }),
        ]),
      );
      expect(contradiction.source_digests).toMatchObject({
        base: expect.any(String),
        current: expect.any(String),
        incoming: expect.any(String),
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("fails atomically for malformed input and materializes an unsafe merged DAG", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const base = `${nodeEvent("TASK-ONE")}\n${nodeEvent("TASK-TWO")}\n`;
      const currentEdge = JSON.stringify({
        kind: "edge",
        edge: { source: "TASK-ONE", type: "derived_from", target: "TASK-TWO" },
      });
      const incomingEdge = JSON.stringify({
        kind: "edge",
        edge: { source: "TASK-TWO", type: "derived_from", target: "TASK-ONE" },
      });
      await writeFile(basePath, base);
      await writeFile(currentPath, "not-json\n");
      await writeFile(incomingPath, base);

      const malformed = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);
      expect(malformed.code).toBe(1);
      const malformedReceipt = JSON.parse(malformed.stdout.text()) as {
        outcome: string;
        diagnostics: Array<{ code: string; source?: string }>;
      };
      expect(malformedReceipt.outcome).toBe("FAILED");
      expect(malformedReceipt.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "MALFORMED_JSONL", source: "current" })]),
      );
      expect(await readFile(currentPath, "utf8")).toBe("not-json\n");

      await writeFile(currentPath, `${base}${currentEdge}\n`);
      await writeFile(incomingPath, `${base}${incomingEdge}\n`);
      const before = await readFile(currentPath, "utf8");
      const cycle = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);
      expect(cycle.code).toBe(0);
      const cycleReceipt = JSON.parse(cycle.stdout.text()) as {
        outcome: string;
        diagnostics: Array<{ code: string; message: string }>;
      };
      if (!cycleReceipt.diagnostics.some(({ code }) => code === "TOPOLOGY_CYCLE")) {
        throw new Error(JSON.stringify(cycleReceipt.diagnostics));
      }
      expect(cycleReceipt.outcome).toBe("DIVERGED");
      expect(cycleReceipt.diagnostics.map(({ code }) => code).join(",")).toContain("CYCLE");
      expect(await readFile(currentPath, "utf8")).not.toBe(before);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("preserves an opposed edge add and tombstone as an inactive divergence", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const base = `${typedNodeEvent("TASK-A", "TASK")}\n${typedNodeEvent("TASK-B", "TASK")}\n`;
      await writeFile(basePath, base);
      await writeFile(currentPath, `${base}${edgeEventOf("TASK-A", "depends_on", "TASK-B")}\n`);
      await writeFile(
        incomingPath,
        `${base}${edgeEventOf("TASK-A", "depends_on", "TASK-B", true)}\n`,
      );

      const result = await invoke(repo, ["merge-driver", "--json", basePath, currentPath, incomingPath]);
      const receipt = JSON.parse(result.stdout.text()) as {
        outcome: string;
        diagnostics: Array<{ code: string }>;
      };

      expect(result.code).toBe(0);
      expect(receipt.outcome).toBe("DIVERGED");
      expect(receipt.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "EDGE_STATE_CONFLICT" })]),
      );
      const events = (await readFile(currentPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { kind: string; node?: Record<string, unknown>; edge?: unknown });
      expect(events.filter(({ kind }) => kind === "edge")).toHaveLength(0);
      expect(events.at(-1)?.node).toMatchObject({
        subject_key: "TASK-A:depends_on:TASK-B",
        base_value: null,
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("quarantines a dangling endpoint and preserves both branch-local states", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const base = `${typedNodeEvent("TASK-A", "TASK")}\n${typedNodeEvent("TASK-B", "TASK")}\n`;
      const removed = typedNodeEvent("TASK-B", "TASK", "TASK-B", { status: "REMOVED", tombstone: true });
      await writeFile(basePath, base);
      await writeFile(currentPath, `${base}${removed}\n`);
      await writeFile(incomingPath, `${base}${edgeEventOf("TASK-A", "depends_on", "TASK-B")}\n`);

      const result = await invoke(repo, ["merge-driver", "--json", basePath, currentPath, incomingPath]);
      const receipt = JSON.parse(result.stdout.text()) as {
        outcome: string;
        created_conflict_ids: string[];
        quarantined_subjects: string[];
      };

      expect(result.code).toBe(0);
      expect(receipt.outcome).toBe("DIVERGED");
      expect(receipt.created_conflict_ids).toHaveLength(1);
      expect(receipt.quarantined_subjects).toEqual(
        expect.arrayContaining(["TASK-B", "TASK-A:depends_on:TASK-B"]),
      );
      const events = (await readFile(currentPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { kind: string; node?: Record<string, unknown>; edge?: unknown });
      expect(events.filter(({ kind }) => kind === "edge")).toHaveLength(0);
      expect(events.find(({ node }) => node?.id === "TASK-B")?.node).not.toHaveProperty("tombstone", true);
      expect(events.at(-1)?.node).toMatchObject({
        type: "CTR",
        quarantined: {
          nodes: [expect.objectContaining({ value: expect.objectContaining({ id: "TASK-B" }) })],
          edges: [expect.objectContaining({ value: { source: "TASK-A", type: "depends_on", target: "TASK-B" } })],
        },
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("quarantines a combined deductive cycle without failing Git merge", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const base = `${typedNodeEvent("TASK-A", "TASK")}\n${typedNodeEvent("TASK-B", "TASK")}\n`;
      await writeFile(basePath, base);
      await writeFile(currentPath, `${base}${edgeEventOf("TASK-A", "derived_from", "TASK-B")}\n`);
      await writeFile(incomingPath, `${base}${edgeEventOf("TASK-B", "derived_from", "TASK-A")}\n`);

      const result = await invoke(repo, ["merge-driver", "--json", basePath, currentPath, incomingPath]);
      const receipt = JSON.parse(result.stdout.text()) as {
        outcome: string;
        diagnostics: Array<{ code: string }>;
      };

      expect(result.code).toBe(0);
      expect(receipt.outcome).toBe("DIVERGED");
      expect(receipt.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "TOPOLOGY_CYCLE" })]),
      );
      const events = (await readFile(currentPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { kind: string; node?: Record<string, unknown> });
      expect(events.filter(({ kind }) => kind === "node")).toHaveLength(3);
      expect(events.filter(({ kind }) => kind === "edge")).toHaveLength(0);
      expect(events.at(-1)?.node).toMatchObject({
        quarantined: {
          edges: expect.arrayContaining([
            expect.objectContaining({ value: { source: "TASK-A", type: "derived_from", target: "TASK-B" } }),
            expect.objectContaining({ value: { source: "TASK-B", type: "derived_from", target: "TASK-A" } }),
          ]),
        },
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("propagates causal quarantine transitively but leaves reference-only additions active", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const base = `${typedNodeEvent("ASM-ROOT", "ASM", "ancestor")}\n`;
      const current = [
        base.trimEnd(),
        typedNodeEvent("ASM-ROOT", "ASM", "current"),
        typedNodeEvent("CAN-DEPENDENT", "CAN"),
        edgeEventOf("CAN-DEPENDENT", "derived_from", "ASM-ROOT"),
        typedNodeEvent("TASK-REFERENCE", "TASK"),
        edgeEventOf("TASK-REFERENCE", "references", "ASM-ROOT"),
      ].join("\n") + "\n";
      const incoming = `${base.trimEnd()}\n${typedNodeEvent("ASM-ROOT", "ASM", "incoming")}\n`;
      await writeFile(basePath, base);
      await writeFile(currentPath, current);
      await writeFile(incomingPath, incoming);

      const result = await invoke(repo, ["merge-driver", "--json", basePath, currentPath, incomingPath]);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout.text())).toMatchObject({ outcome: "DIVERGED" });
      const events = (await readFile(currentPath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { kind: string; node?: Record<string, unknown>; edge?: Record<string, unknown> });
      expect(events.some(({ node }) => node?.id === "CAN-DEPENDENT")).toBe(false);
      expect(events.some(({ edge }) => edge?.type === "derived_from")).toBe(false);
      expect(events.some(({ node }) => node?.id === "TASK-REFERENCE")).toBe(true);
      expect(events.some(({ edge }) => edge?.type === "references")).toBe(true);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("accepts the quarantine ceiling and fails atomically above it", () => {
    const node = (id: string): string => typedNodeEvent(id, "TASK");
    const base = `${node("TASK-A")}\n${node("TASK-B")}\n`;
    const current = `${base}${edgeEventOf("TASK-A", "derived_from", "TASK-B")}\n`;
    const incoming = `${base}${edgeEventOf("TASK-B", "derived_from", "TASK-A")}\n`;
    const atCeiling = mergeBranchModels({ base, current, incoming }, { limits: { maxQuarantinedSubjects: 2 } });
    expect(atCeiling.receipt.outcome).toBe("DIVERGED");
    expect(atCeiling.output).not.toBeNull();

    const overCeiling = mergeBranchModels({ base, current, incoming }, { limits: { maxQuarantinedSubjects: 1 } });
    expect(overCeiling.receipt.outcome).toBe("FAILED");
    expect(overCeiling.output).toBeNull();
    expect(overCeiling.receipt.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "QUARANTINE_CEILING_EXCEEDED" })]),
    );
  });

  it("emits a complete deterministic receipt and fails closed for rebase", async () => {
    const repo = await mkdtemp(join(tmpdir(), "ariadne-merge-"));
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      const swappedCurrentPath = join(repo, "swapped-current.jsonl");
      const swappedIncomingPath = join(repo, "swapped-incoming.jsonl");
      const base = `${nodeEvent("TASK-BASE")}\n`;
      const current = `${base}${nodeEvent("TASK-CURRENT")}\n`;
      const incoming = `${base}${JSON.stringify({
        node: { statement: "TASK-INCOMING", id: "TASK-INCOMING", type: "TASK", provenance_type: "PROPOSED" },
        kind: "node",
      })}\n`;
      await writeFile(basePath, base);
      await writeFile(currentPath, current);
      await writeFile(incomingPath, incoming);
      await writeFile(swappedCurrentPath, incoming);
      await writeFile(swappedIncomingPath, current);

      const first = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);
      const second = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        swappedCurrentPath,
        swappedIncomingPath,
      ]);
      const firstReceipt = JSON.parse(first.stdout.text()) as Record<string, unknown>;
      const secondReceipt = JSON.parse(second.stdout.text()) as Record<string, unknown>;
      expect(firstReceipt).toMatchObject({
        outcome: "CLEAN",
        merge_protocol_version: 1,
        applied_subjects: ["TASK-CURRENT", "TASK-INCOMING"],
        deduplicated_subjects: [],
        diagnostics: [],
        post_merge_verification_requirement: null,
      });
      expect(firstReceipt).toHaveProperty("input_digests");
      expect(firstReceipt).toHaveProperty("output_digest");
      expect(firstReceipt).toHaveProperty("deterministic_detection_coverage");
      expect(firstReceipt.output_digest).toBe(secondReceipt.output_digest);
      expect(await readFile(currentPath, "utf8")).toBe(await readFile(swappedCurrentPath, "utf8"));

      await mkdir(join(repo, ".git", "rebase-merge"), { recursive: true });
      const before = await readFile(currentPath, "utf8");
      const blocked = await invoke(repo, [
        "merge-driver",
        "--json",
        basePath,
        currentPath,
        incomingPath,
      ]);
      expect(blocked.code).toBe(1);
      expect(JSON.parse(blocked.stdout.text())).toMatchObject({
        outcome: "FAILED",
        diagnostics: [expect.objectContaining({ code: "UNSUPPORTED_GIT_OPERATION" })],
      });
      expect(await readFile(currentPath, "utf8")).toBe(before);
      await access(join(repo, ".git", "rebase-merge"));
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
