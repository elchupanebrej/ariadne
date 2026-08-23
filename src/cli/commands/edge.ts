import {
  canonicalEdgeRelation,
  EDGE_TYPES,
  EdgeSchema,
  type EdgeType,
  type EpistemicEdge,
} from "../../core/schemas/edges.js";
import { validateGraph } from "../../graph/integrity.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

type Flags = Map<string, string>;

const parseFlags = (
  args: readonly string[],
  allowed: readonly string[],
): { positionals: string[]; flags: Flags } => {
  const positionals: string[] = [];
  const flags: Flags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (!allowed.includes(arg) || index + 1 >= args.length) {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
    flags.set(arg.slice(2), args[index + 1]);
    index += 1;
  }
  return { positionals, flags };
};

const storageFor = async (io: CliIO) => (await resolveCliWorkspace(io)).storage;

const parseEdge = (args: readonly string[]): EpistemicEdge => {
  if (args.length !== 3) {
    throw new Error("Usage: ariadne edge add <from_id> <relation> <to_id>");
  }
  const [source, relation, target] = args;
  // Canonical relation semantics: formatting aliases are accepted and
  // persisted as their equivalent canonical relation; anything else fails.
  const canonical = canonicalEdgeRelation(relation);
  if (!canonical) {
    throw new Error(`Invalid edge relation: ${relation}`);
  }
  return EdgeSchema.parse({ source, type: canonical, target });
};

const edgeKey = (edge: EpistemicEdge): string =>
  `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

async function addEdge(args: readonly string[], io: CliIO): Promise<EpistemicEdge> {
  const edge = parseEdge(args);
  const storage = await storageFor(io);
  const graph = await storage.materialize();
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(edge.source)) throw new Error(`Edge source ${edge.source} does not exist`);
  if (!nodeIds.has(edge.target)) throw new Error(`Edge target ${edge.target} does not exist`);
  if (graph.edges.some((candidate) => edgeKey(candidate) === edgeKey(edge))) {
    throw new Error(`Edge already exists: ${edgeKey(edge)}`);
  }

  const validation = validateGraph({ nodes: graph.nodes, edges: [...graph.edges, edge] });
  if (!validation.valid) {
    throw new Error(validation.diagnostics.map(({ code, message }) => `${code}: ${message}`).join("; "));
  }
  await storage.appendEdge(edge);
  return edge;
}

async function listEdges(args: readonly string[], io: CliIO): Promise<EpistemicEdge[]> {
  const { positionals, flags } = parseFlags(args, ["--from", "--to", "--relation"]);
  if (positionals.length > 0) throw new Error("Usage: ariadne edge list [--from] [--to] [--relation]");
  const from = flags.get("from");
  const to = flags.get("to");
  const relation = flags.get("relation");
  const canonicalRelation = relation ? canonicalEdgeRelation(relation) : undefined;
  if (relation && !canonicalRelation) {
    throw new Error(`Invalid edge relation: ${relation}`);
  }
  const graph = await (await storageFor(io)).materialize();
  return graph.edges.filter(
    (edge) =>
      (!from || edge.source === from) &&
      (!to || edge.target === to) &&
      (!canonicalRelation || edge.type === canonicalRelation),
  );
}

async function removeEdge(args: readonly string[], io: CliIO): Promise<EpistemicEdge> {
  const edge = parseEdge(args);
  const storage = await storageFor(io);
  const graph = await storage.materialize();
  if (!graph.edges.some((candidate) => edgeKey(candidate) === edgeKey(edge))) {
    throw new Error(`Edge not found: ${edgeKey(edge)}`);
  }
  await storage.appendEdgeTombstone(edge);
  return edge;
}

const EDGE_USAGE = "Usage: ariadne edge <add|list|remove> ...\n";
const EDGE_ADD_USAGE = "Usage: ariadne edge add <from_id> <relation> <to_id>\n";
const EDGE_LIST_USAGE = "Usage: ariadne edge list [--from] [--to] [--relation]\n";
const EDGE_REMOVE_USAGE = "Usage: ariadne edge remove <from_id> <relation> <to_id>\n";

export async function runEdge(args: readonly string[], io: CliIO): Promise<number> {
  const command = args[0];
  if (command === "-h" || command === "--help") {
    io.stdout.write(EDGE_USAGE);
    return 0;
  }
  const rest = args.slice(1);
  let result: EpistemicEdge | EpistemicEdge[];
  switch (command) {
    case "add":
      if (hasHelp(rest)) {
        io.stdout.write(EDGE_ADD_USAGE);
        return 0;
      }
      result = await addEdge(rest, io);
      break;
    case "list":
      if (hasHelp(rest, ["--from", "--to", "--relation"])) {
        io.stdout.write(EDGE_LIST_USAGE);
        return 0;
      }
      result = await listEdges(rest, io);
      break;
    case "remove":
      if (hasHelp(rest)) {
        io.stdout.write(EDGE_REMOVE_USAGE);
        return 0;
      }
      result = await removeEdge(rest, io);
      break;
    default:
      throw new Error(EDGE_USAGE.trim());
  }
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}
