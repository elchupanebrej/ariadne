import {
  isFrontierNode,
  type MaterializedGraph,
} from "../../graph/storage.js";
import {
  isUnresolvedMergeContradiction,
  mergeContradictionGuidance,
  mergeContradictionSubject,
} from "../../merge/three-way.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

export type { CliIO } from "../workspace.js";

type State = Record<string, unknown>;

export type StatusReport = {
  depth_mode: string;
  frontier: string[];
  open_unknowns: string[];
  graph_health: {
    healthy: boolean;
    nodes: number;
    edges: number;
    invalid_references: number;
  };
  merge_conflicts: Array<{
    id: string;
    subject: string;
    status: string;
    card: string;
    guidance: string;
    shadowed_node_id?: string;
  }>;
};

const asIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object" && "id" in item) {
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" ? [id] : [];
    }
    return [];
  });
};

const configuredIds = (state: State, keys: string[]): string[] => {
  for (const key of keys) {
    const ids = asIds(state[key]);
    if (ids.length > 0) return ids;
  }
  return [];
};

const configuredString = (state: State, keys: string[]): string | undefined => {
  for (const key of keys) {
    if (typeof state[key] === "string" && state[key]) return state[key] as string;
  }
  return undefined;
};

export function buildStatusReport(
  state: State | null,
  graph: MaterializedGraph,
): StatusReport {
  const frontierNodes = graph.nodes.filter(isFrontierNode);
  const frontierNodeIds = new Set(frontierNodes.map((node) => node.id));
  const configuredFrontier = configuredIds(state ?? {}, ["frontier", "active_frontier"]);
  const frontier =
    configuredFrontier.length > 0
      ? configuredFrontier.filter((id) => frontierNodeIds.has(id))
      : frontierNodes.map((node) => node.id);

  const openUnknownNodeIds = new Set(
    frontierNodes.filter((node) => node.type === "UNK").map((node) => node.id),
  );
  const configuredUnknowns = configuredIds(state ?? {}, [
    "open_unknowns",
    "openUnknowns",
    "unknowns",
  ]);
  const openUnknowns =
    configuredUnknowns.length > 0
      ? configuredUnknowns.filter((id) => openUnknownNodeIds.has(id))
      : [...openUnknownNodeIds];

  const ids = new Set(graph.nodes.map((node) => node.id));
  const invalidReferences = graph.edges.filter(
    (edge) => !ids.has(edge.source) || !ids.has(edge.target),
  ).length;
  const merge_conflicts = graph.nodes
    .filter(isUnresolvedMergeContradiction)
    .map((node) => {
      const subject = mergeContradictionSubject(node) ?? node.id;
      return {
        id: node.id,
        subject,
        status: node.status ?? "MERGE_CONFLICT",
        card: `.ariadne/cards/${node.id}.md`,
        guidance: mergeContradictionGuidance(node),
        ...(graph.nodes.some((candidate) => candidate.id === subject)
          ? { shadowed_node_id: subject }
          : {}),
      };
    });

  return {
    depth_mode:
      configuredString(state ?? {}, [
        "depth_mode",
        "active_depth_mode",
        "depthMode",
      ]) ?? "Standard",
    frontier,
    open_unknowns: openUnknowns,
    graph_health: {
      healthy: invalidReferences === 0,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      invalid_references: invalidReferences,
    },
    merge_conflicts,
  };
}

const STATUS_USAGE = "Usage: ariadne status [--json]\n";

export async function runStatus(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(STATUS_USAGE);
    return 0;
  }
  const json = args.includes("--json");
  const unexpected = args.filter((arg) => arg !== "--json");
  if (unexpected.length > 0) {
    throw new Error(STATUS_USAGE.trim());
  }

  const { storage } = await resolveCliWorkspace(io);
  const report = buildStatusReport(
    await storage.readState<State>(),
    await storage.materialize(),
  );

  if (json) {
    io.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  }

  io.stdout.write(
    [
      "Ariadne status",
      `Depth mode: ${report.depth_mode}`,
      `Frontier: ${report.frontier.length > 0 ? report.frontier.join(", ") : "none"}`,
      `Open unknowns: ${
        report.open_unknowns.length > 0 ? report.open_unknowns.join(", ") : "none"
      }`,
      `Graph health: ${report.graph_health.healthy ? "healthy" : "unhealthy"} ` +
        `(${report.graph_health.nodes} nodes, ${report.graph_health.edges} edges)`,
      `Merge conflicts: ${
        report.merge_conflicts.length > 0
          ? report.merge_conflicts.map(({ id, subject }) => `${id} (${subject})`).join(", ")
          : "none"
      }`,
      "",
    ].join("\n"),
  );
  return 0;
}
