import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  isUnresolvedMergeContradiction,
  mergeContradictionGuidance,
} from "../../merge/three-way.js";
import { GraphEventSchema, type GraphEvent } from "../../graph/storage.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import type { MaterializedGraph } from "../../graph/storage.js";

export type MergeCheckDiagnostic = {
  code: "UNRESOLVED_MERGE_CONTRADICTION";
  nodeId: string;
  card: string;
  message: string;
  guidance: string;
};

export type MergeCheckReceipt = {
  check: "publication";
  passed: boolean;
  unresolved_conflicts: Array<{ id: string; card: string }>;
  diagnostics: MergeCheckDiagnostic[];
};

const USAGE = "Usage: ariadne merge-check [--json]\n";

const cardPath = (root: string, storageRoot: string, id: string): string =>
  relative(root, join(storageRoot, "cards", `${id}.md`)).replaceAll("\\", "/");

const readOnlyMaterialize = async (
  storageRoot: string,
): Promise<MaterializedGraph> => {
  let content: string;
  try {
    content = await readFile(join(storageRoot, "GRAPH.jsonl"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { nodes: [], edges: [] };
    }
    throw error;
  }

  const nodes = new Map<string, MaterializedGraph["nodes"][number]>();
  const edges = new Map<string, MaterializedGraph["edges"][number]>();
  for (const line of content.split(/\r?\n/u).filter((value) => value.trim())) {
    const event: GraphEvent = GraphEventSchema.parse(JSON.parse(line));
    if (event.kind === "node") nodes.set(event.node.id, event.node);
    else {
      const key = `${event.edge.source}\u0000${event.edge.type}\u0000${event.edge.target}`;
      if (event.tombstone) edges.delete(key);
      else edges.set(key, event.edge);
    }
  }
  return {
    nodes: [...nodes.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    edges: [...edges.values()].sort((left, right) =>
      `${left.source}\u0000${left.type}\u0000${left.target}`.localeCompare(
        `${right.source}\u0000${right.type}\u0000${right.target}`,
      ),
    ),
  };
};

export const buildMergeCheckReceipt = (
  root: string,
  storageRoot: string,
  graph: MaterializedGraph,
): MergeCheckReceipt => {
  const conflicts = graph.nodes
    .filter(isUnresolvedMergeContradiction)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => {
      const card = cardPath(root, storageRoot, node.id);
      const guidance = mergeContradictionGuidance(node);
      return {
        id: node.id,
        card,
        diagnostic: {
          code: "UNRESOLVED_MERGE_CONTRADICTION" as const,
          nodeId: node.id,
          card,
          message: `Unresolved merge contradiction ${node.id}; see ${card}`,
          guidance,
        },
      };
    });

  return {
    check: "publication",
    passed: conflicts.length === 0,
    unresolved_conflicts: conflicts.map(({ id, card }) => ({ id, card })),
    diagnostics: conflicts.map(({ diagnostic }) => diagnostic),
  };
};

export async function runMergeCheck(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(USAGE);
    return 0;
  }
  if (args.some((arg) => arg !== "--json")) throw new Error(USAGE.trim());

  const { environment } = await resolveCliWorkspace(io);
  const receipt = buildMergeCheckReceipt(
    environment.rootPath,
    environment.storageRoot,
    await readOnlyMaterialize(environment.storageRoot),
  );
  if (args.includes("--json")) {
    io.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    io.stdout.write(
      [
        `Ariadne publication check: ${receipt.passed ? "passed" : "blocked"}`,
        ...receipt.diagnostics.map(
          ({ nodeId, card, guidance }) => `- ${nodeId}: ${card} — ${guidance}`,
        ),
        "",
      ].join("\n"),
    );
  }
  return receipt.passed ? 0 : 1;
}

export { USAGE as MERGE_CHECK_USAGE };
