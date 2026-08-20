import { propagateInvalidation } from "../../graph/invalidation.js";
import type { Node } from "../../core/schemas/nodes.js";
import { emitOperationalNotice } from "../../adapters/gsd/operational-notice.js";
import { resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

const parseArgs = (args: readonly string[]): { nodeId: string; evidenceId: string } => {
  if (args.length !== 3 || args[1] !== "--by" || !args[0] || !args[2]) {
    throw new Error("Usage: ariadne invalidate <node_id> --by <evidence_id>");
  }
  return { nodeId: args[0], evidenceId: args[2] };
};

const changed = (before: Node, after: Node): boolean =>
  JSON.stringify(before) !== JSON.stringify(after);

export async function runInvalidation(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  const { nodeId, evidenceId } = parseArgs(args);
  const { storage } = await resolveCliWorkspace(io);
  const graph = await storage.materialize();
  const target = graph.nodes.find(({ id }) => id === nodeId);
  if (!target) throw new Error(`Node not found: ${nodeId}`);
  if (target.type !== "ASM" && target.type !== "HYP") {
    throw new Error(`Invalidation target ${nodeId} must be ASM or HYP`);
  }
  const evidence = graph.nodes.find(({ id }) => id === evidenceId);
  if (!evidence || evidence.type !== "EVD") {
    throw new Error(`Evidence ${evidenceId} must be an EVD node`);
  }

  const result = propagateInvalidation(graph, nodeId, evidenceId);
  const beforeById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const node of result.graph.nodes) {
    const before = beforeById.get(node.id);
    if (before && changed(before, node)) await storage.appendNode(node);
  }

  const affectedNodeIds = result.trace
    .filter(({ status }) => status !== undefined)
    .map(({ node_id }) => node_id)
    .sort((left, right) => left.localeCompare(right));
  const priorState = (await storage.readState<Record<string, unknown>>()) ?? {};
  await storage.writeState({
    ...priorState,
    last_invalidation: {
      node_id: nodeId,
      evidence_id: evidenceId,
      affected_node_ids: affectedNodeIds,
    },
  });
  await emitOperationalNotice(
    io.cwd,
    {
      falsifiedId: nodeId,
      evidenceId,
      affectedIds: affectedNodeIds,
    },
    (banner) => io.stdout.write(`${banner}\n`),
  );
  await storage.regenerateIndex();

  io.stdout.write(
    `${JSON.stringify({
      falsified_node_id: nodeId,
      evidence_id: evidenceId,
      affected_node_ids: affectedNodeIds,
      trace: result.trace,
    })}\n`,
  );
  return 0;
}
