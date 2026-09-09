import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";

describe("EpistemicGraph deep domain module", () => {
  it("manages nodes and auto-synchronizes index and state in-memory", async () => {
    const graph = EpistemicGraph.inMemory();

    const node = await graph.addNode("ASM", "ASM-1", "Check capacity", {
      provenance_type: "ASSUMED",
      statement: "The service can meet the target capacity",
    });

    expect(node.id).toBe("ASM-1");
    expect(node.type).toBe("ASM");
    expect(node.provenance_type).toBe("ASSUMED");

    // Read node
    const found = await graph.getNode("ASM-1");
    expect(found).toMatchObject({ id: "ASM-1", type: "ASM", title: "Check capacity" });

    // Frontier and open unknowns
    expect(await graph.getFrontier()).toEqual(["ASM-1"]);
    expect(await graph.getOpenUnknowns()).toEqual([]);

    // Add an unknown node
    await graph.addNode("UNK", "UNK-1", "Memory profile", {
      provenance_type: "UNKNOWN",
      statement: "What is the peak memory usage?",
    });

    expect(await graph.getFrontier()).toEqual(["ASM-1", "UNK-1"]);
    expect(await graph.getOpenUnknowns()).toEqual(["UNK-1"]);

    // Index rendering
    const index = await graph.renderIndex();
    expect(index).toContain("ASM-1");
    expect(index).toContain("UNK-1");
    expect(index).toContain("Unknowns: 1");
  });

  it("enforces node schema and prevents duplicate IDs", async () => {
    const graph = EpistemicGraph.inMemory();

    await graph.addNode("CAN", "CAN-1", "Candidate mechanism", {
      provenance_type: "PROPOSED",
      statement: "Candidate mechanism",
    });

    // Duplicate ID error
    await expect(
      graph.addNode("CAN", "CAN-1", "Duplicate candidate", {
        provenance_type: "PROPOSED",
        statement: "Duplicate candidate",
      }),
    ).rejects.toThrow("Node CAN-1 already exists");
  });

  it("invalidates in-memory query materialization after a mutation", async () => {
    const graph = EpistemicGraph.inMemory();

    await graph.addNode("UNK", "UNK-1", "Open question", {
      provenance_type: "UNKNOWN",
      statement: "Initial question",
    });
    expect(await graph.listNodes()).toHaveLength(1);

    await graph.addNode("CAN", "CAN-1", "Candidate", {
      provenance_type: "PROPOSED",
      statement: "Candidate answer",
    });

    expect(await graph.getNode("CAN-1")).toMatchObject({ id: "CAN-1" });
    expect((await graph.listNodes()).map(({ id }) => id)).toEqual(["CAN-1", "UNK-1"]);
  });

  it("updates nodes and protects immutable fields (id and type)", async () => {
    const graph = EpistemicGraph.inMemory();

    await graph.addNode("CLM", "CLM-1", "Initial claim", {
      provenance_type: "PROPOSED",
      statement: "Initial claim statement",
    });

    // Valid update
    const updated = await graph.updateNode("CLM-1", {
      title: "Updated claim title",
      payload: { statement: "Updated claim statement" },
    });
    expect(updated.title).toBe("Updated claim title");
    expect(updated.statement).toBe("Updated claim statement");

    // Attempting to change type or id
    await expect(
      graph.updateNode("CLM-1", { payload: { type: "HYP" as any } }),
    ).rejects.toThrow();

    await expect(
      graph.updateNode("CLM-1", { payload: { id: "CLM-2" as any } }),
    ).rejects.toThrow();
  });

  it("adds, lists, and removes edges with endpoint validation and cycle detection", async () => {
    const graph = EpistemicGraph.inMemory();

    await graph.addNode("FRAME", "FRAME-1", "Root frame", {
      provenance_type: "FACT",
      statement: "Root architectural frame",
    });
    await graph.addNode("CAN", "CAN-1", "Candidate 1", {
      provenance_type: "PROPOSED",
      statement: "Candidate mechanism 1",
    });
    await graph.addNode("HYP", "HYP-1", "Hypothesis 1", {
      provenance_type: "PROPOSED",
      statement: "Causal hypothesis 1",
    });

    // Valid edges
    const edge1 = await graph.addEdge("CAN-1", "satisfies", "FRAME-1");
    expect(edge1).toEqual({ source: "CAN-1", type: "satisfies", target: "FRAME-1" });

    const edge2 = await graph.addEdge("CAN-1", "depends_on", "HYP-1");
    expect(edge2).toEqual({ source: "CAN-1", type: "depends_on", target: "HYP-1" });

    // Missing endpoint
    await expect(graph.addEdge("CAN-1", "depends_on", "HYP-NONEXISTENT")).rejects.toThrow(
      "Edge target HYP-NONEXISTENT does not exist",
    );


    // Listing edges
    const allEdges = await graph.listEdges();
    expect(allEdges).toHaveLength(2);

    const filtered = await graph.listEdges({ relation: "depends_on" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].target).toBe("HYP-1");

    // Deductive Cycle Detection (HYP-1 depends on CAN-1 while CAN-1 depends on HYP-1)
    await expect(graph.addEdge("HYP-1", "depends_on", "CAN-1")).rejects.toThrow("CYCLE");

    // Remove edge
    const removed = await graph.removeEdge("CAN-1", "depends_on", "HYP-1");
    expect(removed.source).toBe("CAN-1");
    expect(await graph.listEdges()).toHaveLength(1);
  });

  it("works with FileSystemStorageDriver in physical directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "ariadne-graph-fs-"));
    const graph = EpistemicGraph.open(root);
    await graph.init();

    await graph.addNode("ASM", "ASM-FS", "Filesystem assumption", {
      provenance_type: "ASSUMED",
      statement: "Persists across storage restarts",
    });

    // Check files on disk
    const cardContent = await readFile(join(root, "cards", "ASM-FS.md"), "utf8");
    expect(cardContent).toContain("ASM-FS");
    expect(cardContent).toContain("Filesystem assumption");

    const indexContent = await readFile(join(root, "INDEX.md"), "utf8");
    expect(indexContent).toContain("ASM-FS");

    const stateContent = await readFile(join(root, "STATE.yaml"), "utf8");
    expect(stateContent).toContain("ASM-FS");

    // Reopen from disk in a fresh instance
    const reopened = EpistemicGraph.open(root);
    const nodes = await reopened.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("ASM-FS");
  });

  it("executes atomic transitive invalidation cascades and updates cards and state", async () => {
    const graph = EpistemicGraph.inMemory();

    await graph.addNode("EVD", "EVD-1", "Measured load spike failure", {
      provenance_type: "MEASURED",
      statement: "Load test at 50k req/s revealed token-bucket starvation",
      verdict: "FALSIFIED",
      method: "synthetic load benchmark",
      rung: 7,
      receipt: "sha256:benchmark-receipt-001",
      stdout_digest: "sha256:stdout-digest-001",
      reproducible_environment: "node-22/linux-x64",
    });

    await graph.addNode("ASM", "ASM-1", "Low latency assumption", {
      provenance_type: "ASSUMED",
      statement: "Worker pool queue provides lower tail latency",
    });

    await graph.addNode("CAN", "CAN-1", "Worker pool candidate", {
      provenance_type: "PROPOSED",
      statement: "Worker pool queue implementation",
    });

    await graph.addNode("DEC", "DEC-1", "Architecture decision", {
      provenance_type: "DECIDED",
      statement: "Adopt worker pool queue",
    });

    await graph.addEdge("EVD-1", "falsifies", "ASM-1");
    await graph.addEdge("CAN-1", "depends_on", "ASM-1");
    await graph.addEdge("DEC-1", "depends_on", "CAN-1");

    // Execute invalidation
    const notifications: string[] = [];
    const result = await graph.invalidate("ASM-1", "EVD-1", {
      notify: (banner) => notifications.push(banner),
    });

    expect(result.falsified_node_id).toBe("ASM-1");
    expect(result.evidence_id).toBe("EVD-1");
    expect(result.affected_node_ids).toEqual(["ASM-1", "CAN-1", "DEC-1"]);

    // Check node statuses
    const asm = await graph.getNode("ASM-1");
    expect(asm?.status).toBe("FALSIFIED");

    const can = await graph.getNode("CAN-1");
    expect(can?.status).toBe("INVALIDATED");

    const dec = await graph.getNode("DEC-1");
    expect(dec?.status).toBe("RE-OPENED");
    expect((dec as any)?.invalidation?.needs_review).toBe(true);

    // State update check
    const state = await graph.getState();
    expect(state.last_invalidation).toEqual({
      node_id: "ASM-1",
      evidence_id: "EVD-1",
      affected_node_ids: ["ASM-1", "CAN-1", "DEC-1"],
    });
  });
});
