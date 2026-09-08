import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { ingestMattFile, readMattArtifact } from "../../adapters/matt/ingest.js";
import { detectGsd } from "../../adapters/gsd/detector.js";
import { AriadneHarnessController } from "../../harness/controller.js";
import { NODE_TYPES, NodeSchema, type Node, type NodeType } from "../../core/schemas/nodes.js";
import { PROVENANCE_TYPES, type ProvenanceType } from "../../core/types/nodes.js";
import { findCliWorkspaceRoot, resolveCliWorkspace } from "../workspace.js";
import { hasHelp, parseOptions, syntaxError } from "../contract.js";
import type { CliIO } from "../workspace.js";

/** Runs the arguments that follow `ariadne ingest`. */
export async function runMattIngest(
  args: readonly string[],
  cwd = process.cwd(),
): Promise<Node> {
  if (
    args.length !== 3 ||
    args[0] !== "matt" ||
    args[1].trim() === "" ||
    args[2].trim() === ""
  ) {
    throw new Error("Usage: ariadne ingest matt <skill> <file>");
  }

  return ingestMattFile(args[1], resolve(cwd, args[2]));
}

const gsdRootFor = async (path: string, cwd: string): Promise<string> => {
  let candidate = resolve(cwd, path);
  try {
    if ((await stat(candidate)).isFile()) candidate = dirname(candidate);
  } catch {
    // Let the normal GSD activation check below provide the useful error.
  }

  if (basename(candidate) === ".planning") candidate = dirname(candidate);
  if (detectGsd(candidate).active) return candidate;

  const workspaceRoot = findCliWorkspaceRoot(candidate);
  if (detectGsd(workspaceRoot).active) return workspaceRoot;
  throw new Error(`GSD workspace not found from ${resolve(cwd, path)}`);
};

export async function runGsdIngest(args: readonly string[], cwd = process.cwd()) {
  if (args.length !== 2 || args[0] !== "gsd" || args[1].trim() === "") {
    throw new Error("Usage: ariadne ingest gsd <path>");
  }
  const root = await gsdRootFor(args[1], cwd);
  return new AriadneHarnessController({ rootDirectory: root }).projectGsd();
}

const INGEST_USAGE = "Usage: ariadne ingest <file> [--type <type>]\n";

const generatedId = (type: NodeType, statement: string): string => {
  const digest = createHash("sha256").update(`${type}\u0000${statement}`).digest("hex").slice(0, 12);
  return `${type}-${digest}`;
};

const typedNode = (raw: unknown, typeOverride?: string): Node => {
  const source: Record<string, unknown> =
    typeof raw === "string"
      ? { statement: raw }
      : raw && typeof raw === "object" && !Array.isArray(raw)
        ? { ...(raw as Record<string, unknown>) }
        : (() => {
            throw syntaxError("Ingested file must contain a JSON object or plain text");
          })();
  const statement =
    typeof source.statement === "string" && source.statement.trim() !== ""
      ? source.statement
      : typeof source.summary === "string" && source.summary.trim() !== ""
        ? source.summary
        : typeof source.title === "string" && source.title.trim() !== ""
          ? source.title
          : undefined;
  if (!statement) throw syntaxError("Ingested artifact requires a non-empty statement");

  const requestedType = typeOverride ?? (typeof source.type === "string" ? source.type : "EVDREQ");
  const type = requestedType.toUpperCase() as NodeType;
  if (!NODE_TYPES.includes(type)) {
    throw syntaxError(`Unknown node type: ${requestedType}. Valid node types: ${NODE_TYPES.join(", ")}`);
  }
  const provenance =
    typeof source.provenance_type === "string" && PROVENANCE_TYPES.includes(source.provenance_type as ProvenanceType)
      ? source.provenance_type
      : type === "EVD"
        ? "MEASURED"
        : "PROPOSED";
  const suppliedId = typeof source.id === "string" ? source.id : undefined;
  const id = suppliedId && new RegExp(`^${type}-[0-9A-Za-z_-]+$`, "u").test(suppliedId)
    ? suppliedId
    : generatedId(type, statement);
  try {
    return NodeSchema.parse({
      ...source,
      id,
      type,
      statement,
      provenance_type: provenance,
    });
  } catch (error) {
    throw syntaxError(error instanceof Error ? error.message : String(error));
  }
};

export async function runIngest(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(INGEST_USAGE);
    return 0;
  }
  const parsed = parseOptions(args, [{ name: "type", takesValue: true }], INGEST_USAGE.trim());
  if (parsed.positionals.length !== 1 || parsed.flags.size > 0) {
    throw syntaxError(INGEST_USAGE.trim());
  }
  let raw: unknown;
  try {
    raw = await readMattArtifact(resolve(io.cwd, parsed.positionals[0]!));
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ) {
      throw error;
    }
    throw syntaxError(error instanceof Error ? error.message : String(error));
  }
  const node = typedNode(raw, parsed.values.get("type"));
  const { storage } = await resolveCliWorkspace(io);
  await storage.appendNode(node);
  io.stdout.write(`${JSON.stringify(node)}\n`);
  return 0;
}
