import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSubstrate,
  detectUncertaintySignals,
  isRoutineKnownAnswer,
  selectNextOperation,
  substrateCardsAsNodes,
} from "../../src/adapters/ariadne/preflight.js";
import {
  appendToolingFailure,
  toolingFailureNode,
} from "../../src/adapters/ariadne/tooling.js";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";
import { EdgeSchema, canonicalEdgeRelation } from "../../src/core/schemas/edges.js";

const newRoot = async (): Promise<string> =>
  join(await mkdtemp(join(tmpdir(), "ariadne-ingress-")), ".ariadne");

describe("uncertainty ingress preflight", () => {
  it("routes every explicit uncertainty branch to the right operation", () => {
    const cases: Array<[string, string[]]> = [
      ["The requirement is unclear about which export format we need", ["ambiguous_requirements"]],
      ["We don't know the retry limit for this API", ["unknown_fact"]],
      ["Assuming the cache stays warm under load", ["assumption"]],
      ["Option A versus Option B is a real trade-off between latency and cost", ["competing_candidates"]],
      ["The docs contradict each other about default timeouts", ["contradiction"]],
      ["Migrating the production data is an irreversible cutover", ["risky_transition"]],
    ];
    for (const [text, expectedKinds] of cases) {
      const signals = detectUncertaintySignals(text);
      expect(signals.map((signal) => signal.kind)).toEqual(expectedKinds);
      expect(selectNextOperation(signals)).toBeTruthy();
    }
  });

  it("keeps routine known-answer questions outside the deep route", () => {
    const routine = [
      "What is the default port?",
      "Where are the logs?",
      "How many retries does the client ship with?",
    ];
    for (const text of routine) {
      expect(isRoutineKnownAnswer(text)).toBe(true);
      expect(detectUncertaintySignals(text)).toEqual([]);
    }
  });

  it("builds a validated substrate with cards, frontier, risks, and next operation", () => {
    const substrate = buildSubstrate(
      "This migration of production data is irreversible and we don't know the rollback path",
    );
      expect(substrate.routed).toBe(true);
      const kinds = substrate.cards.map((card) => card.kind).sort();
      expect(kinds).toContain("UNK");
      expect(kinds).toContain("EVDREQ");
      // Risky transitions surface as observations; formal TRANS cards belong
      // to the validate operation.
      expect(kinds).not.toContain("TRANS");
    expect(substrate.operation).toBe("50-knowledge");
    expect(substrate.frontier.length).toBeGreaterThan(0);
    expect(substrate.openRisks.join(" ")).toMatch(/irreversible/);
    for (const card of substrate.cards) {
      expect(card.id).toMatch(/^(?:FRAME|UNK|ASM|CTR|HYP|CAN|EVDREQ|OBS|TRANS)-[0-9A-Za-z_-]+$/);
      expect(card.sourcePointer).toBe(".ariadne/GRAPH.jsonl");
    }
    // Cards convert to persistable nodes.
    const nodes = substrateCardsAsNodes(substrate.cards);
    expect(nodes.length).toBe(substrate.cards.length);
    expect(nodes.every((node) => node.type === node.id.split("-")[0])).toBe(true);
  });
});

describe("grill substrate card links and tooling consistency", () => {
  it("canonicalizes edge relation aliases into equivalent persisted relations", () => {
    expect(canonicalEdgeRelation("depends_on")).toBe("depends_on");
    expect(canonicalEdgeRelation("depends-on")).toBe("depends_on");
    expect(canonicalEdgeRelation("derivedFrom")).toBe("derived_from");
    expect(canonicalEdgeRelation("requires")).toBeUndefined();
    expect(canonicalEdgeRelation("Supports")).toBeUndefined();

    const edge = EdgeSchema.parse({
      source: "CLM-x",
      type: canonicalEdgeRelation("depends-on"),
      target: "UNK-y",
    });
    expect(edge.type).toBe("depends_on");
  });

  it("records tooling failures as OBS observations in the graph", async () => {
    const root = await newRoot();
    const node = await appendToolingFailure(root, {
      command: "ariadne gate run --semantic",
      error: "EACCES on GRAPH.jsonl",
      workaround: "retry after closing editor lock",
      impact: "gate run delayed one cycle; no state mutated",
      component: "semantic-gate",
    });
    expect(node.type).toBe("OBS");
    expect(node.statement).toContain("semantic-gate");
    expect(node.tooling_failure).toMatchObject({ component: "semantic-gate" });

    const graph = await EpistemicGraph.open(root).materialize();
    expect(graph.nodes.some((candidate) => candidate.id === node.id)).toBe(true);

    const deterministic = toolingFailureNode({
      command: "c",
      error: "e",
      workaround: "w",
      impact: "i",
      component: "unit-test",
    });
    expect(deterministic.id).toMatch(/^OBS-tooling-failure-\d+-\d+-unit-test$/);
  });
});
