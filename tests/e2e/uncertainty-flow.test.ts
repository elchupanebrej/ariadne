import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSubstrate,
  detectUncertaintySignals,
  isRoutineKnownAnswer,
} from "../../src/adapters/ariadne/preflight.js";
import { generateGrillSubstrate } from "../../src/adapters/handoff/generator.js";
import { substrateCardsAsNodes } from "../../src/adapters/ariadne/preflight.js";
import { GraphStorage } from "../../src/graph/storage.js";

const newRoot = async (): Promise<string> => await mkdtemp(join(tmpdir(), "ariadne-e2e-uncertainty-"));

const AMBIGUOUS_DESIGN_REQUEST =
  "We need to restructure the export layer; it is unclear whether plugins register themselves or are discovered.";

const EXPLICIT_BRANCHES: Array<[string, string]> = [
  ["We don't know the maximum payload the queue accepts", "50-knowledge"],
  ["Assuming the mirror finishes before the cutover window", "50-knowledge"],
  ["The runbook contradicts the changelog about schema version 3", "20-diagnose"],
  ["Option A versus Option B for the parser rewrite", "40-explore"],
  ["Deprecating the v1 endpoint is a breaking change consumers cannot roll back", "90-validate"],
];

describe("end-to-end uncertainty workflow", () => {
  it("produces Ariadne artifacts from an implicit ambiguous request before any grill questions", async () => {
    const root = await newRoot();
    // Implicit ambiguity: no explicit "unknown" or "assume" wording.
    const substrate = buildSubstrate(AMBIGUOUS_DESIGN_REQUEST);
    expect(substrate.routed).toBe(true);
    expect(substrate.operation).toBe("10-frame");
    expect(substrate.cards.length).toBeGreaterThan(0);

    // Persist the substrate cards, then the grill handoff can only summarize
    // what already exists: preflight strictly precedes grilling.
    const storage = new GraphStorage(root);
    for (const node of substrateCardsAsNodes(substrate.cards)) {
      await storage.appendNode(node);
    }
    const graph = await storage.materialize();
    const grill = await generateGrillSubstrate(graph, { rootDirectory: root });
    expect(grill.content).toContain("pre-decision epistemic substrate");
    expect(graph.nodes.some((node) => node.type === "FRAME")).toBe(true);

    // Falsifying fixture: strip the ambiguity marker and activation must stop.
    const neutralized = AMBIGUOUS_DESIGN_REQUEST.replace(
      "it is unclear whether",
      "it is settled that",
    );
    expect(buildSubstrate(neutralized).routed).toBe(false);
  });

  it("routes each explicit signal to its declared branch operation", () => {
    for (const [text, operation] of EXPLICIT_BRANCHES) {
      const substrate = buildSubstrate(text);
      expect(substrate.operation, text).toBe(operation);
    }
  });

  it("does not activate the deep flow for routine known-answer requests", async () => {
    const root = await newRoot();
    const routine = "What is the default timeout?";
    expect(isRoutineKnownAnswer(routine)).toBe(true);
    expect(detectUncertaintySignals(routine)).toEqual([]);

    const storage = new GraphStorage(root);
    const graph = await storage.materialize();
    // No preflight artifacts were created for the routine request.
    expect(graph.nodes.length).toBe(0);
    const grill = await generateGrillSubstrate(graph, { rootDirectory: root });
    expect(grill.content).toContain("- None");
  });

  it("lets the verifier open every emitted link and reconstruct the frontier", async () => {
    const tmp = await newRoot();
    // Align storage root with the generator's default artifact directory.
    const root = join(tmp, ".ariadne");
    const substrate = buildSubstrate(EXPLICIT_BRANCHES[0][0]);
    const storage = new GraphStorage(root);
    for (const node of substrateCardsAsNodes(substrate.cards)) {
      await storage.appendNode(node);
    }
    const graph = await storage.materialize();
    const grill = await generateGrillSubstrate(graph, { rootDirectory: tmp });

    // Every inline link targets an existing persisted document.
    const hrefs = [...grill.content.matchAll(/\]\(<([^>]+)>\)/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      await expect(access(href)).resolves.toBeUndefined();
    }

    // The frontier is reconstructable from the linked graph file alone.
    const graphFile = join(root, "GRAPH.jsonl");
    const persisted = await readFile(graphFile, "utf8");
    for (const unknownId of substrate.frontier) {
      expect(persisted).toContain(unknownId);
    }
    // And nothing points at invented per-card paths.
    for (const href of hrefs) {
      expect(href.endsWith("GRILL-SUBSTRATE.md")).toBe(false);
    }
  });
});
