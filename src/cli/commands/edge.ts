import { join } from "node:path";
import {
  EDGE_TYPES,
  EdgeSchema,
  type EdgeType,
  type EpistemicEdge,
} from "../../core/schemas/edges.js";
import { GraphStorage } from "../../graph/storage.js";
import { validateGraph } from "../../graph/integrity.js";
import type { CliIO } from "./status.js";

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

const storageFor = (io: CliIO) => new GraphStorage(join(io.cwd, ".ariadne"));

const parseEdge = (args: readonly string[]): EpistemicEdge => {
  if (args.length !== 3) {
    throw new Error("Usage: ariadne edge add <from_id> <relation> <to_id>");
  }
  const [source, relation, target] = args;
  if (!(EDGE_TYPES as readonly string[]).includes(relation)) {
    throw new Error(`Invalid edge relation: ${relation}`);
  }
  return EdgeSchema.parse({ source, type: relation as EdgeType, target });
};

const edgeKey = (edge: EpistemicEdge): string =>
  `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

async function addEdge(args: readonly string[], io: CliIO): Promise<EpistemicEdge> {
  const edge = parseEdge(args);
  const storage = storageFor(io);
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
  if (relation && !(EDGE_TYPES as readonly string[]).includes(relation)) {
    throw new Error(`Invalid edge relation: ${relation}`);
  }
  return (await storageFor(io).materialize()).edges.filter(
    (edge) =>
      (!from || edge.source === from) &&
      (!to || edge.target === to) &&
      (!relation || edge.type === relation),
  );
}

async function removeEdge(args: readonly string[], io: CliIO): Promise<EpistemicEdge> {
  const edge = parseEdge(args);
  const storage = storageFor(io);
  const graph = await storage.materialize();
  if (!graph.edges.some((candidate) => edgeKey(candidate) === edgeKey(edge))) {
    throw new Error(`Edge not found: ${edgeKey(edge)}`);
  }
  await storage.appendEdgeTombstone(edge);
  return edge;
}

export async function runEdge(args: readonly string[], io: CliIO): Promise<number> {
  const command = args[0];
  let result: EpistemicEdge | EpistemicEdge[];
  switch (command) {
    case "add":
      result = await addEdge(args.slice(1), io);
      break;
    case "list":
      result = await listEdges(args.slice(1), io);
      break;
    case "remove":
      result = await removeEdge(args.slice(1), io);
      break;
    default:
      throw new Error("Usage: ariadne edge <add|list|remove> ...");
  }
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}
