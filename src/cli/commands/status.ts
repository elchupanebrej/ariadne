import type { MaterializedGraph } from "../../graph/storage.js";
import { resolveCliWorkspace } from "../workspace.js";
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
  const activeNodes = graph.nodes.filter(
    (node) => node.status !== "INVALIDATED" && node.status !== "REMOVED",
  );
  const frontier =
    configuredIds(state ?? {}, ["frontier", "active_frontier"]).length > 0
      ? configuredIds(state ?? {}, ["frontier", "active_frontier"])
      : activeNodes.map((node) => node.id);
  const openUnknowns =
    configuredIds(state ?? {}, ["open_unknowns", "openUnknowns", "unknowns"]).length > 0
      ? configuredIds(state ?? {}, ["open_unknowns", "openUnknowns", "unknowns"])
      : graph.nodes
          .filter(
            (node) =>
              node.type === "UNK" &&
              node.status !== "RESOLVED" &&
              node.status !== "INVALIDATED" &&
              node.status !== "REMOVED",
          )
          .map((node) => node.id);
  const ids = new Set(graph.nodes.map((node) => node.id));
  const invalidReferences = graph.edges.filter(
    (edge) => !ids.has(edge.source) || !ids.has(edge.target),
  ).length;

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
  };
}

export async function runStatus(args: readonly string[], io: CliIO): Promise<number> {
  const json = args.includes("--json");
  const unexpected = args.filter((arg) => arg !== "--json");
  if (unexpected.length > 0) {
    throw new Error("Usage: ariadne status [--json]");
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
      "",
    ].join("\n"),
  );
  return 0;
}
