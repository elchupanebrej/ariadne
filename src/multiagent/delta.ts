import { z } from "zod";
import { EdgeSchema } from "../core/schemas/edges.js";
import { NodeIdSchema, NodeSchema, type Node } from "../core/schemas/nodes.js";
import { validateGraph } from "../graph/integrity.js";
import type { EpistemicGraph } from "../graph/epistemic-graph.js";
import type { MaterializedGraph } from "../graph/domain.js";

const ExistingNodeMutationSchema = z
  .object({
    id: NodeIdSchema.optional(),
    node_id: NodeIdSchema.optional(),
    expected_status: z.string().min(1).nullable(),
    status: z.string().min(1).optional(),
    invalidation: z.record(z.string(), z.unknown()).optional(),
    invalidation_metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .superRefine((mutation, context) => {
    if (!mutation.id && !mutation.node_id) {
      context.addIssue({ code: "custom", path: ["id"], message: "Mutation requires an existing node id" });
    }
    if (!mutation.status && !mutation.invalidation && !mutation.invalidation_metadata) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Mutation requires status or invalidation metadata",
      });
    }
  });

export const EpistemicDeltaSchema = z
  .object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
    mutations: z.array(ExistingNodeMutationSchema).optional(),
    updates: z.array(ExistingNodeMutationSchema).optional(),
    node_mutations: z.array(ExistingNodeMutationSchema).optional(),
    status_mutations: z.array(ExistingNodeMutationSchema).optional(),
    invalidation_mutations: z.array(ExistingNodeMutationSchema).optional(),
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

const edgeReceiptKey = (edge: { source: string; type: string; target: string }): string =>
  `${edge.source}:${edge.type}:${edge.target}`;

const nodeMutationId = (mutation: z.infer<typeof ExistingNodeMutationSchema>): string =>
  mutation.id ?? mutation.node_id!;

const applyNodeMutation = (
  node: Node,
  mutation: z.infer<typeof ExistingNodeMutationSchema>,
): Node => {
  const next: Record<string, unknown> = { ...node };
  if (mutation.status !== undefined) next.status = mutation.status;
  if (mutation.invalidation !== undefined) next.invalidation = mutation.invalidation;
  if (mutation.invalidation_metadata !== undefined) {
    next.invalidation = mutation.invalidation_metadata;
  }
  return NodeSchema.parse(next);
};

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
  graph: Pick<EpistemicGraph, "batch">,
  response: string,
): Promise<DeltaMergeReceipt> {
  const deltas = extractDeltaBlocks(response);
  return graph.batch((batch) => {
    const current = batch.graph;
    const currentValidation = validateGraph(current);
    if (!currentValidation.valid) throw graphError(current);

    const nodes = new Map(current.nodes.map((node) => [node.id, node]));
    const existingNodeIds = new Set(nodes.keys());
    const edges = new Map(current.edges.map((edge) => [edgeReceiptKey(edge), edge]));
    const events: Array<
      | { kind: "node"; node: (typeof current.nodes)[number] }
      | { kind: "edge"; edge: (typeof current.edges)[number] }
    > = [];
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

      for (const mutation of [
        ...(delta.mutations ?? []),
        ...(delta.updates ?? []),
        ...(delta.node_mutations ?? []),
        ...(delta.status_mutations ?? []),
        ...(delta.invalidation_mutations ?? []),
      ]) {
        const id = nodeMutationId(mutation);
        const previous = nodes.get(id);
        if (!previous || !existingNodeIds.has(id)) {
          throw new Error(`Cannot mutate missing existing node: ${id}`);
        }
        const next = applyNodeMutation(previous, mutation);
        if (stableJson(previous) === stableJson(next)) {
          addUnique(receipt.skipped.nodes, id);
          continue;
        }
        const actualStatus = previous.status ?? null;
        if (actualStatus !== mutation.expected_status) {
          throw new Error(
            `Mutation conflict for ${id}: expected status ${String(mutation.expected_status)}, actual ${String(actualStatus)}`,
          );
        }
        if (
          previous.type === "DEC" &&
          mutation.status !== undefined &&
          mutation.status !== previous.status
        ) {
          throw new Error(`DEC status transition requires authorization: ${id}`);
        }
        nodes.set(id, next);
        events.push({ kind: "node", node: next });
        addUnique(receipt.applied.nodes, id);
      }

      for (const edge of delta.edges) {
        const key = edgeReceiptKey(edge);
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

    if (events.length > 0) batch.appendEvents(events);
    return receipt;
  });
}
