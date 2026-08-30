import {
  canonicalEdgeRelation,
  type EpistemicEdge,
} from "../../core/schemas/edges.js";
import { hasHelp, resolveCliWorkspace, type CliIO } from "../workspace.js";

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

const graphFor = async (io: CliIO) => (await resolveCliWorkspace(io)).graph;

const parseEdgeArgs = (args: readonly string[], usage: string): [string, string, string] => {
  if (args.length !== 3) {
    throw new Error(`${usage} (got ${args.length}, expected 3)`);
  }
  return [args[0], args[1], args[2]];
};

async function addEdge(
  args: readonly string[],
  usage: string,
  io: CliIO,
): Promise<EpistemicEdge> {
  const [source, relation, target] = parseEdgeArgs(args, usage);
  const graph = await graphFor(io);
  return await graph.addEdge(source, relation, target);
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

  const graph = await graphFor(io);
  return await graph.listEdges({
    from,
    to,
    relation: canonicalRelation,
  });
}

async function removeEdge(
  args: readonly string[],
  usage: string,
  io: CliIO,
): Promise<EpistemicEdge> {
  const [source, relation, target] = parseEdgeArgs(args, usage);
  const graph = await graphFor(io);
  return await graph.removeEdge(source, relation, target);
}

const EDGE_USAGE = "Usage: ariadne edge <add|list|remove> ...\n";
const EDGE_ADD_USAGE = "Usage: ariadne edge add <from_id> <relation> <to_id>";
const EDGE_LIST_USAGE = "Usage: ariadne edge list [--from] [--to] [--relation]\n";
const EDGE_REMOVE_USAGE = "Usage: ariadne edge remove <from_id> <relation> <to_id>";

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
        io.stdout.write(`${EDGE_ADD_USAGE}\n`);
        return 0;
      }
      result = await addEdge(rest, EDGE_ADD_USAGE, io);
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
        io.stdout.write(`${EDGE_REMOVE_USAGE}\n`);
        return 0;
      }
      result = await removeEdge(rest, EDGE_REMOVE_USAGE, io);
      break;
    default:
      throw new Error(EDGE_USAGE.trim());
  }
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}
