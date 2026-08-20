import { join } from "node:path";
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
import { GraphStorage } from "../../graph/storage.js";
import type { CliIO } from "./status.js";

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

const storageFor = (io: CliIO) => new GraphStorage(join(io.cwd, ".ariadne"));

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
  const payloadText = flagValue(flags, "payload");
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload must be a JSON object");
    }
    payload = parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid --payload JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const storage = storageFor(io);
  const graph = await storage.materialize();
  const existing = graph.nodes.find((node) => node.id === id);
  if (existing && existing.status !== "REMOVED") {
    throw new Error(`Node already exists: ${id}`);
  }

  const schema = NodeSchemas[type];
  const node = schema.parse({
    ...payload,
    type,
    id,
    title,
    statement: payload.statement ?? title,
  });
  await storage.appendNode(node);
  return node;
}

async function getNode(args: readonly string[], io: CliIO): Promise<Node> {
  const { positionals, flags } = parseFlags(args, []);
  if (positionals.length !== 1 || flags.size > 0) {
    throw new Error("Usage: ariadne node get <id>");
  }
  const node = (await storageFor(io).materialize()).nodes.find(
    (candidate) => candidate.id === positionals[0],
  );
  if (!node) throw new Error(`Node not found: ${positionals[0]}`);
  return node;
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

  return (await storageFor(io).materialize()).nodes.filter(
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
  const storage = storageFor(io);
  const node = (await storage.materialize()).nodes.find(
    (candidate) => candidate.id === positionals[0],
  );
  if (!node) throw new Error(`Node not found: ${positionals[0]}`);
  if (node.status === "REMOVED") throw new Error(`Node already removed: ${node.id}`);
  const tombstone = { ...node, status: "REMOVED", tombstone: true };
  await storage.appendNode(tombstone);
  return tombstone;
}

export async function runNode(args: readonly string[], io: CliIO): Promise<number> {
  const subcommand = args[0];
  if (!subcommand) throw new Error("Usage: ariadne node <add|get|list|remove> ...");

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
    default:
      throw new Error(`Unknown node command: ${subcommand}`);
  }
  io.stdout.write(`${JSON.stringify(result)}\n`);
  return 0;
}
