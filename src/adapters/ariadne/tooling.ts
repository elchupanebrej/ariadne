import type { Node } from "../../core/schemas/nodes.js";
import { ObservationNodeSchema } from "../../core/schemas/nodes.js";
import { GraphStorage } from "../../graph/storage.js";

export interface ToolingFailure {
  command: string;
  error: string;
  workaround: string;
  impact: string;
  component: string;
}

let failureSequence = 0;

// Every internal tooling failure becomes an OBS node carrying the observed
// command, error, workaround, impact, and affected component. The timestamp
// keeps ids unique across processes.
export function toolingFailureNode(
  failure: ToolingFailure,
  timestamp = new Date().toISOString(),
): Node {
  failureSequence += 1;
  const observation = {
    type: "OBS" as const,
    id: `OBS-tooling-failure-${Date.now()}-${failureSequence}-${failure.component}`,
    statement: `Tooling failure in ${failure.component}: ${failure.command} failed (${failure.error}); workaround: ${failure.workaround}; impact: ${failure.impact}`,
    provenance_type: "DERIVED",
    status: "active",
    title: `Tooling failure: ${failure.component}`,
    tooling_failure: {
      command: failure.command,
      error: failure.error,
      workaround: failure.workaround,
      impact: failure.impact,
      component: failure.component,
      observed_at: timestamp,
    },
  };
  return ObservationNodeSchema.parse(observation) as Node;
}

export async function appendToolingFailure(
  rootDirectory: string,
  failure: ToolingFailure,
): Promise<Node> {
  const node = toolingFailureNode(failure);
  const storage = new GraphStorage(rootDirectory);
  await storage.appendNode(node);
  return node;
}
