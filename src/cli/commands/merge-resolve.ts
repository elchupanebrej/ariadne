import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  reconcileMergeContradiction,
  type MergeReconciliationReceipt,
} from "../../merge/reconcile.js";
import { hasHelp, resolveCliWorkspace, type CliIO } from "../workspace.js";
import { parseOptions, parseOutputFormat, syntaxError, writeDomainDiagnostic } from "../contract.js";

const MERGE_RESOLVE_USAGE =
  "Usage: ariadne merge-resolve [--auto]\n" +
  "       ariadne merge-resolve <conflict-id> --expected-digest <digest> " +
  "(--select-digest <digest> | --delta <file>) [--decision-owner <owner>] [--format json]\n";

type ParsedArgs = {
  conflictId: string;
  expectedDigest: string;
  selectDigest?: string;
  deltaPath?: string;
  decisionOwner?: string;
  json: boolean;
  auto: boolean;
};

const parseArgs = (args: readonly string[]): ParsedArgs => {
  const output = parseOutputFormat(args, ["json"], "human", MERGE_RESOLVE_USAGE.trim());
  const legacyJson = output.rest.filter((arg) => arg === "--json");
  if (legacyJson.length > 1 || (legacyJson.length === 1 && output.format === "json")) {
    throw syntaxError("Specify only one JSON output option.");
  }
  const parsed = parseOptions(
    output.rest.filter((arg) => arg !== "--json"),
    [
      { name: "expected-digest", takesValue: true },
      { name: "select-digest", takesValue: true },
      { name: "delta", takesValue: true },
      { name: "decision-owner", takesValue: true },
      { name: "auto" },
    ],
    MERGE_RESOLVE_USAGE.trim(),
  );
  if (parsed.positionals.length === 0 && parsed.flags.has("auto")) {
    if (
      parsed.values.size > 0 ||
      parsed.flags.size !== 1
    ) {
      throw syntaxError(MERGE_RESOLVE_USAGE.trim());
    }
    return {
      conflictId: "",
      expectedDigest: "",
      json: output.format === "json" || legacyJson.length === 1,
      auto: true,
    };
  }
  if (parsed.positionals.length !== 1 || parsed.flags.size > 0) {
    throw syntaxError(MERGE_RESOLVE_USAGE.trim());
  }
  const expectedDigest = parsed.values.get("expected-digest");
  if (!expectedDigest) throw syntaxError("Missing required option: --expected-digest");
  return {
    conflictId: parsed.positionals[0]!,
    expectedDigest,
    ...(parsed.values.has("select-digest")
      ? { selectDigest: parsed.values.get("select-digest")! }
      : {}),
    ...(parsed.values.has("delta") ? { deltaPath: parsed.values.get("delta")! } : {}),
    ...(parsed.values.has("decision-owner")
      ? { decisionOwner: parsed.values.get("decision-owner")! }
      : {}),
    json: output.format === "json" || legacyJson.length === 1,
    auto: false,
  };
};

const summary = (receipt: MergeReconciliationReceipt): string =>
  `Ariadne merge reconciliation ${receipt.outcome}; conflict=${receipt.conflict_id}; ` +
  `applied=${receipt.applied_subjects.length}; released=${receipt.released_subjects.length}; ` +
  `diagnostics=${receipt.diagnostics.map(({ code }) => code).join(", ") || "none"}\n`;

export async function runMergeResolve(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(MERGE_RESOLVE_USAGE);
    return 0;
  }
  const parsed = parseArgs(args);
  if (parsed.auto) {
    const { graph } = await resolveCliWorkspace(io);
    const conflicts = (await graph.materialize()).nodes
      .filter((node) => node.type === "CTR" && node.status === "MERGE_CONFLICT")
      .map(({ id }) => id)
      .sort();
    if (conflicts.length === 0) {
      io.stdout.write("No unresolved merge contradictions.\n");
      return 0;
    }
    writeDomainDiagnostic(
      io,
      parsed.json ? "json" : "human",
      "MERGE_DIVERGED",
      "Automatic merge resolution requires an explicit conflict selection.",
      { conflicts },
    );
    return 1;
  }
  if (
    (parsed.selectDigest === undefined) ===
    (parsed.deltaPath === undefined)
  ) {
    throw syntaxError("Exactly one of --select-digest or --delta is required");
  }
  const delta =
    parsed.deltaPath === undefined
      ? undefined
      : await readFile(resolve(io.cwd, parsed.deltaPath), "utf8");
  const { graph } = await resolveCliWorkspace(io);
  const authorization =
    parsed.decisionOwner === undefined
      ? {}
      : { decisionOwnerAuthorization: parsed.decisionOwner };
  const request =
    parsed.selectDigest !== undefined
      ? {
          conflictId: parsed.conflictId,
          expectedConflictDigest: parsed.expectedDigest,
          selectDigest: parsed.selectDigest,
          ...authorization,
        }
      : {
          conflictId: parsed.conflictId,
          expectedConflictDigest: parsed.expectedDigest,
          delta: delta as string,
          ...authorization,
        };
  const receipt = await reconcileMergeContradiction(graph, request);
  if (parsed.json) io.stdout.write(`${JSON.stringify(receipt)}\n`);
  if (receipt.outcome !== "RESOLVED" && receipt.outcome !== "ALREADY_RESOLVED") {
    writeDomainDiagnostic(
      io,
      parsed.json ? "json" : "human",
      "MERGE_DIVERGED",
      "Ariadne merge reconciliation did not resolve the contradiction.",
      { conflict: receipt.conflict_id, outcome: receipt.outcome, diagnostics: receipt.diagnostics },
    );
  } else {
    io.stderr.write(summary(receipt));
  }
  return receipt.outcome === "RESOLVED" ||
    receipt.outcome === "ALREADY_RESOLVED"
    ? 0
    : 1;
}

export { MERGE_RESOLVE_USAGE };
