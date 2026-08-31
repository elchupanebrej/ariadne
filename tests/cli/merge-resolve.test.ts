import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { reconcileMergeContradiction } from "../../src/merge/reconcile.js";
import { mergeBranchModels } from "../../src/merge/three-way.js";
import { GraphStorage } from "../../src/graph/storage.js";

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
    node: { id, type: "TASK", provenance_type: "PROPOSED", statement, ...extra },
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

const cli = (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  return runCli(args, { cwd, stdout: stdout.stream, stderr: stderr.stream }).then((code) => ({
    code,
    stdout: stdout.text,
    stderr: stderr.text,
  }));
};

describe("merge contradiction reconciliation", () => {
  it("resolves a stored variant with an atomic compare-and-swap", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const variant = (conflict.variants as Array<{ variant_digest: string }>)[0];
      const result = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      });

      expect(result.outcome).toBe("RESOLVED");
      expect((await storage.materialize()).nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "TASK-SHARED", statement: expect.any(String) }),
          expect.objectContaining({ id: conflict.id, status: "RESOLVED" }),
        ]),
      );
      expect((await storage.materialize()).nodes.find(({ id }) => id === "TASK-SHARED")?.statement).toBe(
        (conflict.variants as Array<{ variant_digest: string; value: { statement: string } }>).find(
          ({ variant_digest }) => variant_digest === variant.variant_digest,
        )?.value.statement,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a stale digest and invalid delta without changing projections", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const graphBefore = await readFile(join(directory, "GRAPH.jsonl"), "utf8");
      const indexBefore = await readFile(join(directory, "INDEX.md"), "utf8");
      const stale = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: "stale",
        selectDigest: String(conflict.base_digest),
      });
      expect(stale.outcome).toBe("STALE");
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(graphBefore);
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toBe(indexBefore);

      const invalid = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        delta: { nodes: [], edges: [], unexpected: true } as never,
      });
      expect(invalid.outcome).toBe("REJECTED");
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(graphBefore);
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toBe(indexBefore);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("requires explicit authorization when replacing a locked decision", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-merge-resolve-decision-"));
    try {
      const base = JSON.stringify({
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
      const variant = (conflict.variants as Array<{ variant_digest: string }>)[0];

      const denied = await reconcileMergeContradiction(storage, {
        conflictId: conflict.id,
        expectedConflictDigest: String(conflict.conflict_digest),
        selectDigest: variant.variant_digest,
      });
      expect(denied.outcome).toBe("REJECTED");
      expect(denied.diagnostics.map(({ code }) => code)).toContain(
        "MISSING_DECISION_OWNER_AUTHORIZATION",
      );

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
        ["merge-resolve", conflict.id, "--expected-digest", String(conflict.conflict_digest), "--select-digest", String(conflict.base_digest), "--delta", "missing"],
        { cwd: directory, stdout: stdout.stream, stderr: stderr.stream },
      );
      expect(both).toBe(1);
      expect(stderr.text()).toMatch(/exactly one/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent attempts so the retry is explicit", async () => {
    const { directory, storage, conflict } = await conflictWorkspace();
    try {
      const variant = (conflict.variants as Array<{ variant_digest: string }>)[0];
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
