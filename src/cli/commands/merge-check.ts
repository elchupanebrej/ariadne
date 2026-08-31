import { join, relative } from "node:path";
import {
  isUnresolvedMergeContradiction,
  mergeContradictionGuidance,
} from "../../merge/three-way.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import type { MaterializedGraph } from "../../graph/storage.js";

export type MergeCheckDiagnostic = {
  code: "UNRESOLVED_MERGE_CONTRADICTION";
  nodeId: string;
  card: string;
  message: string;
  guidance: string;
};

export type MergeCheckReceipt = {
  check: "publication";
  passed: boolean;
  unresolved_conflicts: Array<{ id: string; card: string }>;
  diagnostics: MergeCheckDiagnostic[];
};

const USAGE = "Usage: ariadne merge-check [--json]\n";

const cardPath = (root: string, storageRoot: string, id: string): string =>
  relative(root, join(storageRoot, "cards", `${id}.md`)).replaceAll("\\", "/");

export const buildMergeCheckReceipt = (
  root: string,
  storageRoot: string,
  graph: MaterializedGraph,
): MergeCheckReceipt => {
  const conflicts = graph.nodes
    .filter(isUnresolvedMergeContradiction)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node) => {
      const card = cardPath(root, storageRoot, node.id);
      const guidance = mergeContradictionGuidance(node);
      return {
        id: node.id,
        card,
        diagnostic: {
          code: "UNRESOLVED_MERGE_CONTRADICTION" as const,
          nodeId: node.id,
          card,
          message: `Unresolved merge contradiction ${node.id}; see ${card}`,
          guidance,
        },
      };
    });

  return {
    check: "publication",
    passed: conflicts.length === 0,
    unresolved_conflicts: conflicts.map(({ id, card }) => ({ id, card })),
    diagnostics: conflicts.map(({ diagnostic }) => diagnostic),
  };
};

export async function runMergeCheck(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(USAGE);
    return 0;
  }
  if (args.some((arg) => arg !== "--json")) throw new Error(USAGE.trim());

  const { environment, graph } = await resolveCliWorkspace(io);
  const receipt = buildMergeCheckReceipt(
    environment.rootPath,
    environment.storageRoot,
    await graph.materialize(),
  );
  io.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  return receipt.passed ? 0 : 1;
}

export { USAGE as MERGE_CHECK_USAGE };
