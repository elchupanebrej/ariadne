import { z } from "zod";
import { EdgeSchema } from "../core/schemas/edges.js";
import { NodeSchema } from "../core/schemas/nodes.js";
import { validateGraph } from "../graph/integrity.js";
import {
  GraphStorage,
  type MaterializedGraph,
} from "../graph/storage.js";

export const EpistemicDeltaSchema = z
  .object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  })
  .strict();

export type EpistemicDelta = z.infer<typeof EpistemicDeltaSchema>;

export type DeltaMergeReceipt = {
  applied: { nodes: string[]; edges: string[] };
  skipped: { nodes: string[]; edges: string[] };
};

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const edgeKey = (edge: { source: string; type: string; target: string }): string =>
  `${edge.source}:${edge.type}:${edge.target}`;

const parseBlock = (body: string): EpistemicDelta => {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new Error("Invalid JSON in ariadne-delta block");
  }

  try {
    return EpistemicDeltaSchema.parse(value);
  } catch (error) {
    throw new Error(
      `Invalid ariadne-delta schema: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export function extractDeltaBlocks(response: string): EpistemicDelta[] {
  const deltas: EpistemicDelta[] = [];
  const pattern = /```([^\r\n]*)\r?\n([\s\S]*?)```/g;
  for (const match of response.matchAll(pattern)) {
    const info = match[1].trim().toLowerCase();
    if (info === "json ariadne-delta" || info === "ariadne-delta") {
      deltas.push(parseBlock(match[2]));
    }
  }
  if (deltas.length === 0) {
    throw new Error("No ariadne-delta fenced blocks found");
  }
  return deltas;
}

const addUnique = (values: string[], value: string): void => {
  if (!values.includes(value)) values.push(value);
};

const graphError = (graph: MaterializedGraph): Error => {
  const messages = validateGraph(graph).diagnostics.map(({ message }) => message);
  return new Error(`Invalid graph after delta merge: ${messages.join("; ")}`);
};

export async function mergeDelta(
  storage: GraphStorage,
  response: string,
): Promise<DeltaMergeReceipt> {
  const deltas = extractDeltaBlocks(response);
  const current = await storage.materialize();
  const currentValidation = validateGraph(current);
  if (!currentValidation.valid) throw graphError(current);

  const nodes = new Map(current.nodes.map((node) => [node.id, node]));
  const edges = new Map(current.edges.map((edge) => [edgeKey(edge), edge]));
  const events: Array<{ kind: "node"; node: (typeof current.nodes)[number] } | {
    kind: "edge";
    edge: (typeof current.edges)[number];
  }> = [];
  const receipt: DeltaMergeReceipt = {
    applied: { nodes: [], edges: [] },
    skipped: { nodes: [], edges: [] },
  };

  for (const delta of deltas) {
    for (const node of delta.nodes) {
      const previous = nodes.get(node.id);
      if (previous) {
        if (stableJson(previous) !== stableJson(node)) {
          throw new Error(`Conflicting node ID: ${node.id}`);
        }
        addUnique(receipt.skipped.nodes, node.id);
        continue;
      }
      nodes.set(node.id, node);
      events.push({ kind: "node", node });
      addUnique(receipt.applied.nodes, node.id);
    }

    for (const edge of delta.edges) {
      const key = edgeKey(edge);
      if (edges.has(key)) {
        addUnique(receipt.skipped.edges, key);
        continue;
      }
      edges.set(key, edge);
      events.push({ kind: "edge", edge });
      addUnique(receipt.applied.edges, key);
    }
  }

  const merged: MaterializedGraph = {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
  };
  if (!validateGraph(merged).valid) throw graphError(merged);

  await storage.appendEvents(events);
  return receipt;
}
