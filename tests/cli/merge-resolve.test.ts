import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { reconcileMergeContradiction } from "../../src/merge/reconcile.js";
import { mergeBranchModels } from "../../src/merge/three-way.js";
import { GraphStorage } from "../../src/graph/storage.js";
import { validateGraph } from "../../src/graph/integrity.js";

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

const nodeEvent = (
  id: string,
  statement = id,
  extra: Record<string, unknown> = {},
): string =>
  JSON.stringify({
    kind: "node",
    node: {
      id,
      type: "TASK",
      provenance_type: "PROPOSED",
      statement,
      ...extra,
    },
  });

const conflictWorkspace = async () => {
  const directory = await mkdtemp(join(tmpdir(), "ariadne-merge-resolve-"));
  const base = `${nodeEvent("TASK-SHARED")}\n`;
  const current = `${base}${nodeEvent("TASK-SHARED", "current")}\n`;
  const incoming = `${base}${nodeEvent("TASK-SHARED", "incoming")}\n`;
  const merged = mergeBranchModels({ base, current, incoming });
  if (!merged.output) throw new Error("Expected a merge output");
  const storage = new GraphStorage(directory);
  await storage.appendEvents(
    merged.output
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
  const conflict = (await storage.materialize()).nodes.find(
    (node) => node.type === "CTR" && node.status === "MERGE_CONFLICT",
  );
  if (!conflict) throw new Error("Expected a merge contradiction");
  return { directory, storage, conflict };
};

const topologyConflictWorkspace = async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "ariadne-merge-resolve-topology-"),
  );
  const node = (id: string): string => nodeEvent(id);
  const edge = (source: string, target: string): string =>
    JSON.stringify({
      kind: "edge",
      edge: { source, type: "derived_from", target },
    });
  const base = `${node("TASK-A")}\n${node("TASK-B")}\n`;
  const merged = mergeBranchModels({
    base,
    current: `${base}${edge("TASK-A", "TASK-B")}\n`,
    incoming: `${base}${edge("TASK-B", "TASK-A")}\n`,
  });
  if (!merged.output) throw new Error("Expected a merge output");
  const storage = new GraphStorage(directory);
  await storage.appendEvents(
    merged.output
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
  const conflict = (await storage.materialize()).nodes.find(
    (node) => node.type === "CTR" && node.status === "MERGE_CONFLICT",
  );
  if (!conflict) throw new Error("Expected a topology contradiction");
  return { directory, storage, conflict };
};

const topologyConflictWithChangedNodeWorkspace = async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "ariadne-merge-resolve-topology-node-"),
  );
  const base = `${nodeEvent("TASK-A")}\n${nodeEvent("TASK-B")}\n`;
  const edge = (source: string, target: string): string =>
    JSON.stringify({
      kind: "edge",
      edge: { source, type: "derived_from", target },
    });
  const merged = mergeBranchModels({
    base,
    current: `${base}${nodeEvent("TASK-A", "changed")}
${edge("TASK-A", "TASK-B")}\n`,
    incoming: `${base}${edge("TASK-B", "TASK-A")}\n`,
  });
  if (!merged.output) throw new Error("Expected a merge output");
  const storage = new GraphStorage(directory);
  await storage.appendEvents(
    merged.output
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
  const conflict = (await storage.materialize()).nodes.find(
    (node) => node.type === "CTR" && node.status === "MERGE_CONFLICT",
  );
  if (!conflict) throw new Error("Expected a topology contradiction");
  return { directory, storage, conflict };
};

const topologyConflictWithLockedDecisionWorkspace = async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "ariadne-merge-resolve-topology-decision-"),
  );
  const decision = (statement: string): string =>
    JSON.stringify({
      kind: "node",
      node: {
        id: "DEC-ROOT",
        type: "DEC",
        provenance_type: "DECIDED",
        status: "DECIDED",
        statement,
        adversarial_critique: "reviewed",
        decision_owner: "owner-1",
      },
    });
  const task = JSON.stringify({
    kind: "node",
    node: {
      id: "TASK-TARGET",
      type: "TASK",
      provenance_type: "FACT",
      statement: "target",
    },
  });
  const edge = (source: string, target: string): string =>
    JSON.stringify({
      kind: "edge",
      edge: { source, type: "derived_from", target },
    });
  const base = `${decision("ancestor")}\n${task}\n`;
  const merged = mergeBranchModels({
    base,
    current: `${base}${decision("current")}\n${edge("DEC-ROOT", "TASK-TARGET")}\n`,
    incoming: `${base}${edge("TASK-TARGET", "DEC-ROOT")}\n`,
  });
  if (!merged.output) throw new Error("Expected a merge output");
  const storage = new GraphStorage(directory);
  await storage.appendEvents(
    merged.output
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
  const conflict = (await storage.materialize()).nodes.find(
    (node) => node.type === "CTR" && node.status === "MERGE_CONFLICT",
  );
  if (!conflict) throw new Error("Expected a topology contradiction");
  return { directory, storage, conflict };
};

const cli = (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  return runCli(args, {
    cwd,
    stdout: stdout.stream,
    stderr: stderr.stream,
  }).then((code) => ({
    code,
    stdout: stdout.text,
    stderr: stderr.text,
  }));
};

describe("merge contradiction reconciliation", () => {
  it("resolves a stored variant with an atomic compare-and-swap", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const variant = (
        conflict.variants as Array<{ variant_digest: string }>
      )[0];
      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      });

      expect(result.outcome).toBe("RESOLVED");
      expect((await storage.materialize()).nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "TASK-SHARED",
            statement: expect.any(String),
          }),
          expect.objectContaining({ id: conflict.id, status: "RESOLVED" }),
        ]),
      );
      expect(
        (await storage.materialize()).nodes.find(
          ({ id }) => id === "TASK-SHARED",
        )?.statement,
      ).toBe(
        (
          conflict.variants as Array<{
            variant_digest: string;
            value: { statement: string };
          }>
        ).find(
          ({ variant_digest }) => variant_digest === variant.variant_digest,
        )?.value.statement,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a stored digest whose content was changed and rejects replacement graphs", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const variant = (
        conflict.variants as Array<{
          variant_digest: string;
          value: Record<string, unknown>;
        }>
      )[0];
      const forgedConflict = {
        ...conflict,
        variants: (conflict.variants as Array<Record<string, unknown>>).map(
          (candidate, index) =>
            index === 0
              ? {
                  ...candidate,
                  value: {
                    ...(candidate.value as Record<string, unknown>),
                    statement: "tampered after the digest was recorded",
                  },
                }
              : candidate,
        ),
      };
      await storage.appendNode(forgedConflict);
      const before = await readFile(join(directory, "GRAPH.jsonl"), "utf8");

      const tampered = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      });
      expect(tampered.outcome).toBe("REJECTED");
      expect(tampered.diagnostics.map(({ code }) => code)).toContain(
        "INVALID_VARIANT_DIGEST",
      );
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        before,
      );

      const replacement = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
        replacementGraph: { nodes: [], edges: [] },
      } as never);
      expect(replacement.outcome).toBe("REJECTED");
      expect(
        replacement.diagnostics.map(({ code }) => code),
      ).toContain("INVALID_RECONCILIATION_REQUEST");
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        before,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a non-contradiction ID without changing the graph", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "ariadne-merge-resolve-invalid-id-"),
    );
    try {
      const storage = new GraphStorage(directory);
      await storage.appendNode({
        id: "TASK-NOT-A-CONFLICT",
        type: "TASK",
        provenance_type: "FACT",
        statement: "ordinary task",
      });
      const before = await readFile(join(directory, "GRAPH.jsonl"), "utf8");

      const result = await reconcileMergeContradiction(storage, {
        conflictId: "TASK-NOT-A-CONFLICT",
        expectedConflictDigest: "digest",
        selectDigest: "digest",
      });

      expect(result.outcome).toBe("REJECTED");
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        "INVALID_CONFLICT_ID",
      );
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        before,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a stale digest and invalid delta without changing projections", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const graphBefore = await readFile(
        join(directory, "GRAPH.jsonl"),
        "utf8",
      );
      const indexBefore = await readFile(join(directory, "INDEX.md"), "utf8");
      const stale = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: "stale",
        selectDigest: String(conflict.base_digest),
      });
      expect(stale.outcome).toBe("STALE");
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        graphBefore,
      );
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toBe(
        indexBefore,
      );

      const invalid = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        delta: { nodes: [], edges: [], unexpected: true } as never,
      });
      expect(invalid.outcome).toBe("REJECTED");
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        graphBefore,
      );
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toBe(
        indexBefore,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires explicit authorization when replacing a locked decision", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "ariadne-merge-resolve-decision-"),
    );
    try {
      const base =
        JSON.stringify({
          kind: "node",
          node: {
            id: "DEC-LOCKED",
            type: "DEC",
            provenance_type: "DECIDED",
            status: "DECIDED",
            statement: "ancestor",
            adversarial_critique: "reviewed",
          },
        }) + "\n";
      const current = `${base}${base.replace("ancestor", "current")}\n`;
      const incoming = `${base}${base.replace("ancestor", "incoming")}\n`;
      const merged = mergeBranchModels({ base, current, incoming });
      if (!merged.output) throw new Error("Expected a merge output");
      const storage = new GraphStorage(directory);
      await storage.appendEvents(
        merged.output
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
      const conflict = (await storage.materialize()).nodes.find(
        (node) => node.type === "CTR" && node.status === "MERGE_CONFLICT",
      );
      if (!conflict) throw new Error("Expected a merge contradiction");
      const variant = (
        conflict.variants as Array<{ variant_digest: string }>
      )[0];

      const denied = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      });
      expect(denied.outcome).toBe("REJECTED");
      expect(denied.diagnostics.map(({ code }) => code)).toContain(
        "MISSING_DECISION_OWNER_AUTHORIZATION",
      );

      const booleanAuthorization = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
        decisionOwnerAuthorization: true as never,
      });
      expect(booleanAuthorization.outcome).toBe("REJECTED");
      expect(
        booleanAuthorization.diagnostics.map(({ code }) => code),
      ).toContain("MISSING_DECISION_OWNER_AUTHORIZATION");

      const allowed = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
        decisionOwnerAuthorization: "owner-confirmed",
      });
      expect(allowed.outcome).toBe("RESOLVED");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("restores only structurally valid quarantined topology after base selection", async () => {
    const { directory, storage, conflict } = await topologyConflictWorkspace();
    try {
      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: String(conflict.base_digest),
      });

      expect(result.outcome).toBe("RESOLVED");
      expect(result.released_subjects).toHaveLength(1);
      const graph = await storage.materialize();
      expect(validateGraph(graph).valid).toBe(true);
      expect(graph.edges).toHaveLength(1);
      expect(graph.nodes.find(({ id }) => id === conflict.id)?.status).toBe(
        "RESOLVED",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("restores a changed quarantined node when its topology is released", async () => {
    const { directory, storage, conflict } =
      await topologyConflictWithChangedNodeWorkspace();
    try {
      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: String(conflict.base_digest),
      });

      expect(result.outcome).toBe("RESOLVED");
      expect(result.released_subjects).toContain("TASK-A");
      expect((await storage.materialize()).nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "TASK-A", statement: "changed" }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed quarantine without changing graph history", async () => {
    const { directory, storage, conflict } =
      await topologyConflictWithChangedNodeWorkspace();
    try {
      const quarantined = conflict.quarantined as {
        nodes: Array<Record<string, unknown>>;
        edges: Array<Record<string, unknown>>;
      };
      await storage.appendNode({
        ...conflict,
        quarantined: {
          ...quarantined,
          nodes: quarantined.nodes.map((entry, index) =>
            index === 0
              ? {
                  ...entry,
                  value: {
                    ...(entry.value as Record<string, unknown>),
                    id: "not-a-valid-node-id",
                  },
                }
              : entry,
          ),
        },
      });
      const before = await readFile(join(directory, "GRAPH.jsonl"), "utf8");

      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: String(conflict.base_digest),
      });

      expect(result.outcome).toBe("REJECTED");
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        "INVALID_QUARANTINE",
      );
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        before,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires authorization before restoring a quarantined locked decision", async () => {
    const { directory, storage, conflict } =
      await topologyConflictWithLockedDecisionWorkspace();
    try {
      const request = {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: String(conflict.base_digest),
      };
      const denied = await reconcileMergeContradiction(storage, request);
      expect(denied.outcome).toBe("REJECTED");
      expect(denied.diagnostics.map(({ code }) => code)).toContain(
        "MISSING_DECISION_OWNER_AUTHORIZATION",
      );

      const allowed = await reconcileMergeContradiction(storage, {
        ...request,
        decisionOwnerAuthorization: "owner-1",
      });
      expect(allowed.outcome).toBe("RESOLVED");
      expect((await storage.materialize()).nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "DEC-ROOT", statement: "current" }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts a delta mutation that resolves a quarantined topology subject", async () => {
    const { directory, storage, conflict } = await topologyConflictWorkspace();
    try {
      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        delta: {
          nodes: [],
          edges: [],
          mutations: [
            { id: "TASK-A", expected_status: null, status: "ACTIVE" },
          ],
        },
      });

      expect(result.outcome).toBe("RESOLVED");
      expect(result.applied_subjects).toContain("TASK-A");
      expect((await storage.materialize()).nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "TASK-A", status: "ACTIVE" }),
        ]),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a reconciliation that newly invalidates a dependent node", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "ariadne-merge-resolve-evidence-"),
    );
    try {
      const base =
        [
          nodeEvent("ASM-ROOT", "ancestor", { type: "ASM", status: "ACTIVE" }),
          nodeEvent("CAN-OWNER", "owner", {
            type: "CAN",
            dependencies: ["ASM-ROOT"],
          }),
          JSON.stringify({
            kind: "edge",
            edge: {
              source: "CAN-OWNER",
              type: "depends_on",
              target: "ASM-ROOT",
            },
          }),
        ].join("\n") + "\n";
      const current = `${base}${nodeEvent("ASM-ROOT", "current", { type: "ASM", status: "INVALIDATED" })}\n`;
      const incoming = `${base}${nodeEvent("ASM-ROOT", "incoming", { type: "ASM", status: "INVALIDATED" })}\n`;
      const merged = mergeBranchModels({ base, current, incoming });
      if (!merged.output) throw new Error("Expected a merge output");
      const storage = new GraphStorage(directory);
      await storage.appendEvents(
        merged.output
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
      const conflict = (await storage.materialize()).nodes.find(
        (node) => node.type === "CTR" && node.status === "MERGE_CONFLICT",
      );
      if (!conflict) throw new Error("Expected a merge contradiction");
      const variant = (
        conflict.variants as Array<{ variant_digest: string }>
      )[0];
      const before = await readFile(join(directory, "GRAPH.jsonl"), "utf8");

      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      });

      expect(result.outcome).toBe("REJECTED");
      expect(result.diagnostics.map(({ code }) => code)).toContain(
        "INVALID_DEPENDENCY_STATUS",
      );
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        before,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("accepts one ariadne-delta mode and gives a structured repeated outcome", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const canonical = {
        id: "TASK-SHARED",
        type: "TASK",
        provenance_type: "FACT",
        statement: "synthesized",
      };
      const first = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        delta: { nodes: [canonical], edges: [] } as never,
      });
      expect(first.outcome).toBe("RESOLVED");
      const second = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        delta: { nodes: [canonical], edges: [] } as never,
      });
      expect(second.outcome).toBe("ALREADY_RESOLVED");

      const stdout = capture();
      const stderr = capture();
      const both = await runCli(
        [
          "merge-resolve",
          conflict.id,
          "--expected-digest",
          String(conflict.conflict_digest),
          "--select-digest",
          String(conflict.base_digest),
          "--delta",
          "missing",
        ],
        { cwd: directory, stdout: stdout.stream, stderr: stderr.stream },
      );
      expect(both).toBe(2);
      expect(stderr.text()).toMatch(/exactly one/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects repeated reconciliation mode flags before opening the workspace", async () => {
    const { directory, conflict } = await conflictWorkspace();
    try {
      const result = await cli(directory, [
        "merge-resolve",
        conflict.id,
        "--expected-digest",
        String(conflict.conflict_digest),
        "--select-digest",
        String(conflict.base_digest),
        "--select-digest",
        String(conflict.base_digest),
      ]);

      expect(result.code).toBe(2);
      expect(result.stderr()).toMatch(/only once|exactly one/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent attempts so the retry is explicit", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const variant = (
        conflict.variants as Array<{ variant_digest: string }>
      )[0];
      const request = {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      };
      const results = await Promise.all([
        reconcileMergeContradiction(storage, request),
        reconcileMergeContradiction(storage, request),
      ]);
      expect(results.map(({ outcome }) => outcome).sort()).toEqual([
        "ALREADY_RESOLVED",
        "RESOLVED",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
