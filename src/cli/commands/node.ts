import {
  NODE_TYPES,
  NodeSchemas,
  type Node,
  type NodeType,
} from "../../core/schemas/nodes.js";
import {
  PROVENANCE_TYPES,
  type ProvenanceType,
} from "../../core/types/nodes.js";
import { resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

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

const storageFor = async (io: CliIO) => (await resolveCliWorkspace(io)).storage;

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

  const storage = await storageFor(io);
  const graph = await storage.materialize();
  const existing = graph.nodes.find((node) => node.id === id);
  if (existing && existing.status !== "REMOVED") {
    throw new Error(`Node already exists: ${id}`);
  }

  const node = NodeSchemas[type].parse({
    ...payload,
    type,
    id,
    title,
    statement: payload.statement ?? title,
  }) as Node;
  await storage.appendNode(node);
  return node;
}

async function getNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, []);
  if (positionals.length !== 1 || flags.size > 0) {
    throw new Error("Usage: ariadne node get <id>");
  }
  const graph = await (await storageFor(io)).materialize();
  const found = graph.nodes.find(
    (candidate) => candidate.id === positionals[0],
  );
  if (!found) throw new Error(`Node not found: ${positionals[0]}`);
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

  const graph = await (await storageFor(io)).materialize();
  return graph.nodes.filter(
    (node) =>
      node.status !== "REMOVED" &&
      (typeof type !== "string" || node.type === type) &&
      (typeof provenance !== "string" || node.provenance_type === provenance),
  );
}

async function removeNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, []);
  if (positionals.length !== 1 || flags.size > 0) {
    throw new Error("Usage: ariadne node remove <id>");
  }
  const storage = await storageFor(io);
  const node = (await storage.materialize()).nodes.find(
    (candidate) => candidate.id === positionals[0],
  );
  if (!node) throw new Error(`Node not found: ${positionals[0]}`);
  if (node.status === "REMOVED") throw new Error(`Node already removed: ${node.id}`);
  const tombstone = { ...node, status: "REMOVED", tombstone: true };
  await storage.appendNode(tombstone);
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

  const storage = await storageFor(io);
  return await storage.transaction((graph) => {
    const existing = graph.nodes.find((node) => node.id === id);
    if (!existing || existing.status === "REMOVED") {
      throw new Error(`Node not found: ${id}`);
    }

    if (payload.id !== undefined && payload.id !== id) {
      throw new Error(`Cannot change node id: ${String(payload.id)}`);
    }
    if (payload.type !== undefined && payload.type !== existing.type) {
      throw new Error(`Cannot change node type: ${String(payload.type)}`);
    }

    const type = existing.type;
    const titleToUse = typeof title === "string" ? title : (payload.title as string | undefined) ?? existing.title;

    const merged = {
      ...existing,
      ...payload,
      id,
      type,
      ...(titleToUse !== undefined ? { title: titleToUse } : {}),
    };

    const schema = NodeSchemas[type];
    if (!schema) {
      throw new Error(`Unknown node type schema: ${type}`);
    }

    const updatedNode = schema.parse(merged) as Node;
    return {
      result: updatedNode,
      events: [{ kind: "node", node: updatedNode }],
    };
  });
}

export async function runNode(args: readonly string[], io: CliIO): Promise<number> {
  const subcommand = args[0];
  if (!subcommand) throw new Error("Usage: ariadne node <add|get|list|remove|update> ...");

  let result: Node | Node[];
  switch (subcommand) {
    case "add":
      result = await addNode(args.slice(1), io);
      break;
    case "get":
      result = await getNode(args.slice(1), io);
      break;
    case "list":
      result = await listNodes(args.slice(1), io);
      break;
    case "remove":
      result = await removeNode(args.slice(1), io);
      break;
    case "update":
      result = await updateNode(args.slice(1), io);
      break;
    default:
      throw new Error(`Unknown node command: ${subcommand}`);
  }
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}
