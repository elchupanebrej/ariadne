import { readFile } from "node:fs/promises";
import {
  reconcileMergeContradiction,
  type MergeReconciliationReceipt,
} from "../../merge/reconcile.js";
import { hasHelp, resolveCliWorkspace, type CliIO } from "../workspace.js";

const MERGE_RESOLVE_USAGE =
  "Usage: ariadne merge-resolve <conflict-id> --expected-digest <digest> (--select-digest <digest> | --delta <file>) [--decision-owner <owner>] [--json]\n";

type ParsedArgs = {
  conflictId: string;
  expectedDigest: string;
  selectDigest?: string;
  deltaPath?: string;
  decisionOwner?: string;
  authorizeDecisionOwner: boolean;
  json: boolean;
};

const required = (value: string | undefined, option: string): string => {
  if (!value || value.trim() === "") throw new Error(`Missing required option: ${option}`);
  return value;
};

const parseArgs = (args: readonly string[]): ParsedArgs => {
  const [conflictId, ...rest] = args;
  if (!conflictId || conflictId.startsWith("--")) throw new Error(MERGE_RESOLVE_USAGE.trim());
  let expectedDigest: string | undefined;
  let selectDigest: string | undefined;
  let deltaPath: string | undefined;
  let decisionOwner: string | undefined;
  let authorizeDecisionOwner = false;
  let json = false;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--authorize-decision-owner") {
      authorizeDecisionOwner = true;
      continue;
    }
    if (
      arg === "--expected-digest" ||
      arg === "--select-digest" ||
      arg === "--delta" ||
      arg === "--decision-owner"
    ) {
      const value = rest[++index];
      if (!value || value.startsWith("--")) throw new Error(MERGE_RESOLVE_USAGE.trim());
      if (arg === "--expected-digest") expectedDigest = value;
      else if (arg === "--select-digest") selectDigest = value;
      else if (arg === "--delta") deltaPath = value;
      else decisionOwner = value;
      continue;
    }
    throw new Error(MERGE_RESOLVE_USAGE.trim());
  }
  return {
    conflictId,
    expectedDigest: required(expectedDigest, "--expected-digest"),
    ...(selectDigest !== undefined ? { selectDigest } : {}),
    ...(deltaPath !== undefined ? { deltaPath } : {}),
    ...(decisionOwner !== undefined ? { decisionOwner } : {}),
    authorizeDecisionOwner,
    json,
  };
};

const summary = (receipt: MergeReconciliationReceipt): string =>
  `Ariadne merge reconciliation ${receipt.outcome}; conflict=${receipt.conflict_id}; ` +
  `applied=${receipt.applied_subjects.length}; released=${receipt.released_subjects.length}; ` +
  `diagnostics=${receipt.diagnostics.map(({ code }) => code).join(", ") || "none"}\n`;

export async function runMergeResolve(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(MERGE_RESOLVE_USAGE);
    return 0;
  }
  const parsed = parseArgs(args);
  if ((parsed.selectDigest === undefined) === (parsed.deltaPath === undefined)) {
    throw new Error("Exactly one of --select-digest or --delta is required");
  }
  const delta = parsed.deltaPath === undefined ? undefined : await readFile(parsed.deltaPath, "utf8");
  const { storage } = await resolveCliWorkspace(io);
  const receipt = await reconcileMergeContradiction(storage, {
    conflictId: parsed.conflictId,
    expectedConflictDigest: parsed.expectedDigest,
    ...(parsed.selectDigest !== undefined ? { selectDigest: parsed.selectDigest } : {}),
    ...(delta !== undefined ? { delta } : {}),
    ...(parsed.decisionOwner !== undefined
      ? { decisionOwnerAuthorization: parsed.decisionOwner }
      : parsed.authorizeDecisionOwner
        ? { decisionOwnerAuthorization: true as const }
        : {}),
  });
  if (parsed.json) io.stdout.write(`${JSON.stringify(receipt)}\n`);
  io.stderr.write(summary(receipt));
  return receipt.outcome === "RESOLVED" || receipt.outcome === "ALREADY_RESOLVED" ? 0 : 1;
}

export { MERGE_RESOLVE_USAGE };
