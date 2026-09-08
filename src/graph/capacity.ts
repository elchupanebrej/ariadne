import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { AriadneError } from "../core/errors.js";

// Top-level constant aliases (mirrors CAPACITY_LIMITS for direct import convenience)
export const MAX_NODES = 10_000;
export const MAX_EDGES = 25_000;
export const MAX_EVENTS = 50_000;
export const MAX_RSS_BYTES = 256 * 1024 * 1024;
export const COMPACTION_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const COMPACTION_EVENT_RATIO = 3;

export const CAPACITY_LIMITS = {
  MAX_NODES: 10_000,
  MAX_EDGES: 25_000,
  MAX_EVENTS: 50_000,
  MAX_RSS_BYTES: 256 * 1024 * 1024,
  COMPACTION_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  COMPACTION_EVENT_RATIO: 3,
} as const;

export const CAPACITY_EXCEEDED_MESSAGE =
  "Graph exceeded declared capacity limits (10K nodes, 25K edges, 50K events)";

export const CAPACITY_EXCEEDED_REPAIR =
  "Archive older branches or run compaction.";

export const COMPACTION_ADVISORY_MESSAGE =
  "Advisory: GRAPH.jsonl exceeds compaction threshold (10 MB or 3x entity count). Run 'ariadne report' to archive old trees.";

export interface CapacityCheckCounts {
  nodeCount?: number;
  edgeCount?: number;
  eventCount?: number;
}

/**
 * Asserts that the graph or operation does not breach the declared 10K capacity envelope.
 * Throws AriadneError(CAPACITY_EXCEEDED) fail-closed if any ceiling is breached.
 */
export function assertWithinCapacity(counts: CapacityCheckCounts): void {
  if (counts.nodeCount !== undefined && counts.nodeCount > CAPACITY_LIMITS.MAX_NODES) {
    throw new AriadneError({
      code: "CAPACITY_EXCEEDED",
      message: CAPACITY_EXCEEDED_MESSAGE,
      repair: CAPACITY_EXCEEDED_REPAIR,
      detail: {
        limit: "nodes",
        current: counts.nodeCount,
        ceiling: CAPACITY_LIMITS.MAX_NODES,
      },
    });
  }

  if (counts.edgeCount !== undefined && counts.edgeCount > CAPACITY_LIMITS.MAX_EDGES) {
    throw new AriadneError({
      code: "CAPACITY_EXCEEDED",
      message: CAPACITY_EXCEEDED_MESSAGE,
      repair: CAPACITY_EXCEEDED_REPAIR,
      detail: {
        limit: "edges",
        current: counts.edgeCount,
        ceiling: CAPACITY_LIMITS.MAX_EDGES,
      },
    });
  }

  if (counts.eventCount !== undefined && counts.eventCount > CAPACITY_LIMITS.MAX_EVENTS) {
    throw new AriadneError({
      code: "CAPACITY_EXCEEDED",
      message: CAPACITY_EXCEEDED_MESSAGE,
      repair: CAPACITY_EXCEEDED_REPAIR,
      detail: {
        limit: "events",
        current: counts.eventCount,
        ceiling: CAPACITY_LIMITS.MAX_EVENTS,
      },
    });
  }
}

/**
 * Alias for assertWithinCapacity with a counts object using the shorter key names
 * expected by test imports (nodes/edges/events instead of nodeCount/edgeCount/eventCount).
 */
export function checkCapacityLimits(counts: { nodes?: number; edges?: number; events?: number }): void {
  assertWithinCapacity({
    nodeCount: counts.nodes,
    edgeCount: counts.edges,
    eventCount: counts.events,
  });
}

/**
 * Checks whether the journal on disk exceeds the compaction threshold:
 * either absolute file size > 10 MB or canonical events > 3x materialized entity count.
 * Returns the advisory string if triggered, or null otherwise.
 */
export async function checkCompactionAdvisory(storageRoot: string): Promise<string | null> {
  const graphPath = join(storageRoot, "GRAPH.jsonl");
  try {
    const fileStat = await stat(graphPath);
    if (fileStat.size > CAPACITY_LIMITS.COMPACTION_FILE_SIZE_BYTES) {
      return COMPACTION_ADVISORY_MESSAGE;
    }

    const content = await readFile(graphPath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    const eventCount = lines.length;
    if (eventCount === 0) return null;

    const nodeIds = new Set<string>();
    const activeEdges = new Set<string>();

    for (const line of lines) {
      try {
        const raw = JSON.parse(line);
        const event =
          raw && typeof raw === "object" && "schemaVersion" in raw && "payload" in raw
            ? (raw as { payload: unknown }).payload
            : raw;
        if (event && typeof event === "object") {
          const typedEvent = event as {
            kind?: string;
            node?: { id?: string };
            edge?: { source: string; type: string; target: string };
            tombstone?: boolean;
          };
          if (typedEvent.kind === "node" && typedEvent.node?.id) {
            nodeIds.add(typedEvent.node.id);
          } else if (typedEvent.kind === "edge" && typedEvent.edge) {
            const key = `${typedEvent.edge.source}\u0000${typedEvent.edge.type}\u0000${typedEvent.edge.target}`;
            if (typedEvent.tombstone) {
              activeEdges.delete(key);
            } else {
              activeEdges.add(key);
            }
          }
        }
      } catch {
        // Ignore unparseable lines in advisory check
      }
    }

    const entityCount = nodeIds.size + activeEdges.size;
    if (eventCount > CAPACITY_LIMITS.COMPACTION_EVENT_RATIO * entityCount) {
      return COMPACTION_ADVISORY_MESSAGE;
    }

    return null;
  } catch {
    return null;
  }
}
