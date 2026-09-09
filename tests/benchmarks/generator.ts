import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  EDGE_TYPES,
  type EdgeType,
  type EpistemicEdge,
} from "../../src/core/schemas/edges.js";
import {
  NODE_TYPES,
  NodeSchemas,
  type Node,
  type NodeType,
} from "../../src/core/schemas/nodes.js";
import type { ProvenanceType } from "../../src/core/types/nodes.js";
import { createFramedRecord } from "../../src/graph/journal.js";
import {
  renderCard,
  renderIndex,
  stateForGraph,
  type GraphEvent,
  type MaterializedGraph,
} from "../../src/graph/storage.js";

export const BENCHMARK_TIERS = {
  smoke: { nodes: 100, edges: 250, events: 500, cards: 100, reports: 50, processes: 2 },
  mid: { nodes: 1_000, edges: 2_500, events: 5_000, cards: 1_000, reports: 50, processes: 2 },
  ceiling: {
    nodes: 10_000,
    edges: 25_000,
    events: 50_000,
    cards: 10_000,
    reports: 50,
    processes: 2,
  },
} as const;

export const BENCHMARK_THRESHOLDS = {
  fastMs: 100,
  standardMs: 1_500,
  batchMs: 10_000,
  rssBytes: 640 * 1024 * 1024,
  maxConcurrentProcesses: 2,
} as const;

export type BenchmarkCapacities = {
  nodes: number;
  edges: number;
  events: number;
  cards: number;
  reports: number;
  processes: number;
};

export type BenchmarkTier = keyof typeof BENCHMARK_TIERS;

export interface BenchmarkDataset {
  tier: BenchmarkTier;
  nodes: Node[];
  edges: EpistemicEdge[];
  events: GraphEvent[];
  seed: number;
  capacities: BenchmarkCapacities;
}

export interface GenerateBenchmarkOptions {
  seed?: number;
}

/**
 * Mulberry32 deterministic, seedable 32-bit PRNG.
 */
export function createPrng(seed = 42): () => number {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROPOSITION_NODE_TYPES: readonly NodeType[] = [
  "TASK",
  "FRAME",
  "OBS",
  "CLM",
  "HYP",
  "CTR",
  "CAN",
  "ASM",
  "TRANS",
  "DEC",
  "TRF",
  "VAL-SELECT",
];

const EVIDENCE_NODE_TYPES: readonly NodeType[] = ["EVD", "VAL"];

const EDGE_ENDPOINT_CONTRACTS: Record<
  EdgeType,
  { source: readonly NodeType[]; target: readonly NodeType[] }
> = {
  supports: {
    source: [...PROPOSITION_NODE_TYPES, ...EVIDENCE_NODE_TYPES],
    target: PROPOSITION_NODE_TYPES,
  },
  contradicts: {
    source: PROPOSITION_NODE_TYPES,
    target: PROPOSITION_NODE_TYPES,
  },
  depends_on: {
    source: [...PROPOSITION_NODE_TYPES, "EVDREQ"],
    target: [...PROPOSITION_NODE_TYPES, "UNK"],
  },
  derived_from: {
    source: PROPOSITION_NODE_TYPES,
    target: [...PROPOSITION_NODE_TYPES, ...EVIDENCE_NODE_TYPES],
  },
  answers: {
    source: ["EVD"],
    target: ["EVDREQ"],
  },
  tests: {
    source: ["EVD", "VAL", "EVDREQ"],
    target: ["CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"],
  },
  falsifies: {
    source: ["EVD", "VAL"],
    target: ["HYP", "ASM", "CAN"],
  },
  invalidates: {
    source: PROPOSITION_NODE_TYPES,
    target: ["TASK", "CLM", "HYP", "ASM", "CAN", "TRANS", "DEC"],
  },
  satisfies: {
    source: ["EVD", "VAL", "CLM", "HYP", "CAN", "DEC", "TASK"],
    target: ["TASK", "FRAME", "CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"],
  },
  violates: {
    source: ["EVD", "VAL", "CLM", "HYP", "ASM", "CAN", "DEC", "TASK"],
    target: ["TASK", "FRAME", "CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"],
  },
  supersedes: {
    source: NODE_TYPES,
    target: NODE_TYPES,
  },
  references: {
    source: NODE_TYPES,
    target: NODE_TYPES,
  },
};

/**
 * Returns all valid edge relation types between a source node type and target node type.
 */
export function getValidRelations(sourceType: NodeType, targetType: NodeType): EdgeType[] {
  const valid: EdgeType[] = [];
  for (const edgeType of EDGE_TYPES) {
    const contract = EDGE_ENDPOINT_CONTRACTS[edgeType];
    if (contract.source.includes(sourceType) && contract.target.includes(targetType)) {
      if (edgeType === "supersedes" && sourceType !== targetType) continue;
      valid.push(edgeType);
    }
  }
  return valid;
}

interface NodeTemplate {
  type: NodeType;
  provenance: ProvenanceType;
  prefix: string;
  extra?: Record<string, unknown>;
}

const NODE_TEMPLATES: readonly NodeTemplate[] = [
  { type: "FRAME", provenance: "PROPOSED", prefix: "FRAME" },
  { type: "UNK", provenance: "PROPOSED", prefix: "UNK" },
  { type: "CAN", provenance: "PROPOSED", prefix: "CAN" },
  { type: "EVDREQ", provenance: "PROPOSED", prefix: "EVDREQ" },
  { type: "EVD", provenance: "FACT", prefix: "EVD", extra: { verdict: "SUPPORTED" } },
  { type: "DEC", provenance: "DECIDED", prefix: "DEC" },
  { type: "CLM", provenance: "PROPOSED", prefix: "CLM" },
  {
    type: "HYP",
    provenance: "PROPOSED",
    prefix: "HYP",
    extra: { falsification_conditions: ["Falsified by negative empirical benchmark"] },
  },
  { type: "TASK", provenance: "PROPOSED", prefix: "TASK" },
  { type: "ASM", provenance: "ASSUMED", prefix: "ASM" },
];

/**
 * Generates a deterministic benchmark dataset complying with Ariadne schemas
 * and topological DAG invariants.
 */
export function generateBenchmarkGraph(
  tier: BenchmarkTier,
  options?: GenerateBenchmarkOptions,
): BenchmarkDataset {
  const seed = options?.seed ?? 42;
  const prng = createPrng(seed);
  const { nodes: targetNodes, edges: targetEdges, events: targetEvents } =
    BENCHMARK_TIERS[tier];

  // 1. Generate Nodes
  const nodes: Node[] = [];
  for (let i = 0; i < targetNodes; i += 1) {
    const template = i === 0 ? NODE_TEMPLATES[0] : NODE_TEMPLATES[i % NODE_TEMPLATES.length];
    const id = `${template.prefix}-${i}`;
    const rawNode: Record<string, unknown> = {
      type: template.type,
      id,
      title: `${template.prefix} node ${i}`,
      statement: `Benchmark synthesized statement for node ${id} at tier ${tier}`,
      provenance_type: template.provenance,
      status: "ACTIVE",
      ...(template.extra ?? {}),
    };
    const schema = NodeSchemas[template.type];
    const parsed = schema.parse(rawNode) as Node;
    nodes.push(parsed);
  }

  // 2. Generate Edges as a strict topological DAG (source i -> target j with i > j)
  const edges: EpistemicEdge[] = [];
  const edgeKeys = new Set<string>();

  const makeEdgeKey = (source: string, type: string, target: string): string =>
    `${source}\u0000${type}\u0000${target}`;

  // Tree backbone: connect each node i (i >= 1) to an earlier node j < i
  for (let i = 1; i < targetNodes && edges.length < targetEdges; i += 1) {
    const j = Math.floor(prng() * i);
    const sourceNode = nodes[i];
    const targetNode = nodes[j];
    const relations = getValidRelations(sourceNode.type, targetNode.type);
    const relIndex = Math.floor(prng() * relations.length);
    const relation = relations[relIndex];
    const key = makeEdgeKey(sourceNode.id, relation, targetNode.id);
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({
        source: sourceNode.id,
        type: relation,
        target: targetNode.id,
      });
    }
  }

  // Additional edges to satisfy targetEdges count
  let attempts = 0;
  const maxAttempts = targetEdges * 20;
  while (edges.length < targetEdges && attempts < maxAttempts) {
    attempts += 1;
    // Pick i in [1, targetNodes - 1]
    const i = 1 + Math.floor(prng() * (targetNodes - 1));
    // Pick j in [0, i - 1] to guarantee topological DAG (no cycles)
    const j = Math.floor(prng() * i);
    const sourceNode = nodes[i];
    const targetNode = nodes[j];
    const relations = getValidRelations(sourceNode.type, targetNode.type);
    if (relations.length === 0) continue;
    const relIndex = Math.floor(prng() * relations.length);
    const relation = relations[relIndex];
    const key = makeEdgeKey(sourceNode.id, relation, targetNode.id);
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({
        source: sourceNode.id,
        type: relation,
        target: targetNode.id,
      });
    }
  }

  // If still need edges, fill by iterating deterministically
  if (edges.length < targetEdges) {
    for (let i = 1; i < targetNodes && edges.length < targetEdges; i += 1) {
      for (let j = 0; j < i && edges.length < targetEdges; j += 1) {
        const relations = getValidRelations(nodes[i].type, nodes[j].type);
        for (const rel of relations) {
          const key = makeEdgeKey(nodes[i].id, rel, nodes[j].id);
          if (!edgeKeys.has(key)) {
            edgeKeys.add(key);
            edges.push({
              source: nodes[i].id,
              type: rel,
              target: nodes[j].id,
            });
            if (edges.length >= targetEdges) break;
          }
        }
      }
    }
  }

  // 3. Assemble Canonical Events History to match targetEvents
  // Event structure:
  // - First targetNodes events: node additions
  // - Next targetEdges events: edge additions
  // - Remaining events: node revision updates (in-place mutations)
  const events: GraphEvent[] = [];

  for (const node of nodes) {
    events.push({ kind: "node", node });
  }

  for (const edge of edges) {
    events.push({ kind: "edge", edge });
  }

  const remainingEvents = targetEvents - events.length;
  for (let k = 0; k < remainingEvents; k += 1) {
    const nodeIdx = k % nodes.length;
    const baseNode = nodes[nodeIdx];
    const revNum = Math.floor(k / nodes.length) + 1;
    const updatedNode: Node = {
      ...baseNode,
      statement: `${baseNode.statement} [rev ${revNum}]`,
    };
    events.push({ kind: "node", node: updatedNode });
  }

  return {
    tier,
    nodes,
    edges,
    events,
    seed,
    capacities: {
      nodes: targetNodes,
      edges: targetEdges,
      events: targetEvents,
      cards: BENCHMARK_TIERS[tier].cards,
      reports: BENCHMARK_TIERS[tier].reports,
      processes: BENCHMARK_TIERS[tier].processes,
    },
  };
}

export interface PopulateStorageOptions {
  skipCards?: boolean;
}

/**
 * Populates an isolated storage directory on disk with the benchmark dataset:
 * V1 framed GRAPH.jsonl, STATE.yaml, INDEX.md, and markdown cards.
 */
export async function populateBenchmarkStorage(
  storageRoot: string,
  dataset: BenchmarkDataset,
  options?: PopulateStorageOptions,
): Promise<void> {
  await mkdir(storageRoot, { recursive: true });

  // 1. Write V1 Framed GRAPH.jsonl
  const framedLines: string[] = [];
  for (let idx = 0; idx < dataset.events.length; idx += 1) {
    const frame = createFramedRecord({
      payload: dataset.events[idx],
      sequence: idx + 1,
    });
    framedLines.push(JSON.stringify(frame));
  }
  await writeFile(
    join(storageRoot, "GRAPH.jsonl"),
    framedLines.join("\n") + "\n",
    "utf8",
  );

  // 2. Write STATE.yaml
  const graph: MaterializedGraph = { nodes: dataset.nodes, edges: dataset.edges };
  const state = stateForGraph({ mode: "standalone", schema_version: 1 }, graph);
  await writeFile(
    join(storageRoot, "STATE.yaml"),
    JSON.stringify(state, null, 2) + "\n",
    "utf8",
  );

  // 3. Write INDEX.md
  await writeFile(
    join(storageRoot, "INDEX.md"),
    renderIndex(graph),
    "utf8",
  );

  // 4. Write Cards (in batches for I/O performance)
  if (!options?.skipCards) {
    const cardsDir = join(storageRoot, "cards");
    await mkdir(cardsDir, { recursive: true });
    const batchSize = 250;
    for (let i = 0; i < dataset.nodes.length; i += batchSize) {
      const batch = dataset.nodes.slice(i, i + batchSize);
      await Promise.all(
        batch.map((node) =>
          writeFile(join(cardsDir, `${node.id}.md`), renderCard(node), "utf8"),
        ),
      );
    }
  }
}
