import {
  NODE_TYPES,
  type Node,
  type NodeType,
} from "../../core/schemas/nodes.js";
import {
  PROVENANCE_TYPES,
  type ProvenanceType,
} from "../../core/types/nodes.js";
import { hasHelp, resolveCliWorkspace, type CliIO } from "../workspace.js";

type Flags = Map<string, string | true>;

const parseFlags = (
  args: readonly string[],
  valueFlags: readonly string[],
  booleanFlags: readonly string[] = [],
): { positionals: string[]; flags: Flags } => {
  const positionals: string[] = [];
  const flags: Flags = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    if (booleanFlags.includes(arg)) {
      flags.set(arg.slice(2), true);
      continue;
    }
    if (!valueFlags.includes(arg) || index + 1 >= args.length) {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
    flags.set(arg.slice(2), args[index + 1]);
    index += 1;
  }
  return { positionals, flags };
};

const isNodeType = (value: string): value is NodeType =>
  NODE_TYPES.includes(value as NodeType);

const isProvenance = (value: string): value is ProvenanceType =>
  PROVENANCE_TYPES.includes(value as ProvenanceType);

const flagValue = (flags: Flags, name: string): string => {
  const value = flags.get(name);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required option: --${name}`);
  }
  return value;
};

const parsePayload = (flags: Flags): Record<string, unknown> => {
  const payloadText = flagValue(flags, "payload");
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid --payload JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const graphFor = async (io: CliIO) => (await resolveCliWorkspace(io)).graph;

async function addNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, ["--title", "--payload"]);
  if (positionals.length !== 2) {
    throw new Error(
      "Usage: ariadne node add <type> <id> --title <title> --payload <json>",
    );
  }
  const [type, id] = positionals;
  if (!isNodeType(type)) throw new Error(`Unknown node type: ${type}`);
  const title = flagValue(flags, "title");
  const payload = parsePayload(flags);

  const graph = await graphFor(io);
  const existing = await graph.getNode(id);
  if (existing && existing.status !== "REMOVED") {
    throw new Error(`Node already exists: ${id}`);
  }

  return await graph.addNode(type, id, title, payload);
}

async function getNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, []);
  if (positionals.length !== 1 || flags.size > 0) {
    throw new Error("Usage: ariadne node get <id>");
  }
  const [id] = positionals;
  const graph = await graphFor(io);
  const found = await graph.getNode(id);
  if (!found) throw new Error(`Node not found: ${id}`);
  return found;
}

async function listNodes(args: readonly string[], io: CliIO): Promise<Node[]> {
  const { positionals, flags } = parseFlags(args, ["--type", "--provenance"]);
  if (positionals.length > 0) throw new Error("Usage: ariadne node list [--type] [--provenance]");
  const type = flags.get("type");
  const provenance = flags.get("provenance");
  if (typeof type === "string" && !isNodeType(type)) {
    throw new Error(`Unknown node type: ${type}`);
  }
  if (typeof provenance === "string" && !isProvenance(provenance)) {
    throw new Error(`Unknown provenance: ${provenance}`);
  }

  const graph = await graphFor(io);
  return await graph.listNodes({
    type: type as NodeType | undefined,
    provenance: provenance as ProvenanceType | undefined,
  });
}

async function removeNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, []);
  if (positionals.length !== 1 || flags.size > 0) {
    throw new Error("Usage: ariadne node remove <id>");
  }
  const [id] = positionals;
  const graph = await graphFor(io);
  const node = await graph.getNode(id);
  if (!node) throw new Error(`Node not found: ${id}`);
  if (node.status === "REMOVED") throw new Error(`Node already removed: ${node.id}`);

  const tombstone = { ...node, status: "REMOVED", tombstone: true };
  await graph.updateNode(id, { status: "REMOVED", payload: { tombstone: true } });
  return tombstone;
}

async function updateNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, ["--title", "--payload"]);
  if (positionals.length !== 1) {
    throw new Error(
      "Usage: ariadne node update <id> [--title <title>] --payload <json>",
    );
  }
  const [id] = positionals;
  const payload = parsePayload(flags);

  const title = flags.get("title");
  if (typeof title === "string" && title.trim() === "") {
    throw new Error("Missing required option: --title");
  }

  const graph = await graphFor(io);
  const existing = await graph.getNode(id);
  if (!existing || existing.status === "REMOVED") {
    throw new Error(`Node not found: ${id}`);
  }

  if (payload.id !== undefined && payload.id !== id) {
    throw new Error(`Cannot change node id: ${String(payload.id)}`);
  }
  if (payload.type !== undefined && payload.type !== existing.type) {
    throw new Error(`Cannot change node type: ${String(payload.type)}`);
  }

  return await graph.updateNode(id, {
    title: typeof title === "string" ? title : undefined,
    payload,
  });
}

const NODE_USAGE = "Usage: ariadne node <add|get|list|remove|update> ...\n";
const NODE_ADD_USAGE = "Usage: ariadne node add <type> <id> --title <title> --payload <json>\n";
const NODE_GET_USAGE = "Usage: ariadne node get <id>\n";
const NODE_LIST_USAGE = "Usage: ariadne node list [--type] [--provenance]\n";
const NODE_REMOVE_USAGE = "Usage: ariadne node remove <id>\n";
const NODE_UPDATE_USAGE = "Usage: ariadne node update <id> [--title <title>] --payload <json>\n";

export async function runNode(args: readonly string[], io: CliIO): Promise<number> {
  const subcommand = args[0];
  if (subcommand === "-h" || subcommand === "--help") {
    io.stdout.write(NODE_USAGE);
    return 0;
  }
  if (!subcommand) throw new Error(NODE_USAGE.trim());

  const rest = args.slice(1);
  let result: Node | Node[];
  switch (subcommand) {
    case "add":
      if (hasHelp(rest, ["--title", "--payload"])) {
        io.stdout.write(NODE_ADD_USAGE);
        return 0;
      }
      result = await addNode(rest, io);
      break;
    case "get":
      if (hasHelp(rest)) {
        io.stdout.write(NODE_GET_USAGE);
        return 0;
      }
      result = await getNode(rest, io);
      break;
    case "list":
      if (hasHelp(rest, ["--type", "--provenance"])) {
        io.stdout.write(NODE_LIST_USAGE);
        return 0;
      }
      result = await listNodes(rest, io);
      break;
    case "remove":
      if (hasHelp(rest)) {
        io.stdout.write(NODE_REMOVE_USAGE);
        return 0;
      }
      result = await removeNode(rest, io);
      break;
    case "update":
      if (hasHelp(rest, ["--title", "--payload"])) {
        io.stdout.write(NODE_UPDATE_USAGE);
        return 0;
      }
      result = await updateNode(rest, io);
      break;
    default:
      throw new Error(`Unknown node command: ${subcommand}`);
  }
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}
