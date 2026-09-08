/**
 * Startup integrity scan, torn write tail recovery, and projection repair engine.
 */

import fs from "node:fs";
import path from "node:path";
import { AriadneError } from "../core/errors.js";
import { canonicalizePath } from "../core/containment.js";
import {
  verifyFrame,
  stageAndSwapProjection,
  type FramedRecord,
} from "./journal.js";
import { withRootLock } from "./lock.js";
import { NodeSchema } from "../core/schemas/nodes.js";
import { EdgeSchema } from "../core/schemas/edges.js";
import {
  GraphEventSchema,
  renderIndex,
  renderCard,
  applyEvents,
  stateForGraph,
  type MaterializedGraph,
  type GraphEvent,
} from "./storage.js";

export interface JournalScanDiagnostic {
  code: "INCOMPLETE_TAIL";
  message: string;
  repair?: string;
  detail?: Record<string, unknown>;
}

export interface JournalScanResult {
  validRecords: number;
  recoveredTail: boolean;
  truncatedBytes: number;
  lastSequence: number;
  diagnostic?: JournalScanDiagnostic;
  records: FramedRecord<unknown>[];
}

/**
 * Scans a canonical journal (e.g. GRAPH.jsonl or NOTICES.jsonl) and verifies each frame.
 * If the final record at EOF is truncated, incomplete, or corrupted (torn write from a crash/power halt),
 * it safely truncates the file back to the last verified frame offset using fs.promises.truncate
 * and returns a recovery result with recoveredTail: true, byte count truncated, and an INCOMPLETE_TAIL diagnostic.
 *
 * Any corruption, checksum mismatch, schema invalidity, or sequence break occurring prior to
 * the final frame is catastrophic middle-log corruption: automatic truncation is strictly prohibited
 * and it immediately throws AriadneError(CORRUPT_PERSISTED_HISTORY).
 */
export async function scanAndRecoverJournal(
  journalPath: string,
): Promise<JournalScanResult> {
  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(journalPath);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return {
        validRecords: 0,
        recoveredTail: false,
        truncatedBytes: 0,
        lastSequence: 0,
        records: [],
      };
    }
    throw err;
  }

  if (buffer.length === 0) {
    return {
      validRecords: 0,
      recoveredTail: false,
      truncatedBytes: 0,
      lastSequence: 0,
      records: [],
    };
  }

  let lineStart = 0;
  let lastValidOffset = 0;
  const records: FramedRecord<unknown>[] = [];

  while (lineStart < buffer.length) {
    const nextNewline = buffer.indexOf(0x0a, lineStart);
    const lineEnd = nextNewline === -1 ? buffer.length : nextNewline;
    const recordEnd = nextNewline === -1 ? buffer.length : nextNewline + 1;

    const lineBytes = buffer.subarray(lineStart, lineEnd);
    const lineStr = lineBytes.toString("utf8").replace(/\r$/, "");

    if (lineStr.trim().length === 0) {
      lineStart = recordEnd;
      continue;
    }

    const remainingAfter = buffer.subarray(recordEnd).toString("utf8").trim();
    const isFinalFrame = remainingAfter.length === 0;

    let parsed: unknown;
    let isValid = true;

    try {
      parsed = JSON.parse(lineStr);
    } catch {
      isValid = false;
    }

    if (isValid && !verifyFrame(parsed)) {
      isValid = false;
    }

    if (isValid) {
      const rec = parsed as FramedRecord<unknown>;
      if (records.length > 0) {
        if (rec.sequence !== records[records.length - 1].sequence + 1) {
          isValid = false;
        }
      }
    }

    if (!isValid) {
      if (!isFinalFrame) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: "Middle corruption or checksum mismatch detected in canonical history",
          repair: "Inspect .ariadne/GRAPH.jsonl or restore from backup.",
          detail: {
            journalPath,
            offset: lineStart,
            sequence:
              parsed && typeof parsed === "object" && "sequence" in parsed
                ? (parsed as { sequence?: unknown }).sequence
                : undefined,
          },
        });
      }

      // Final frame incomplete / corrupted: truncate back to last valid frame offset
      const truncatedBytes = buffer.length - lastValidOffset;
      await fs.promises.truncate(journalPath, lastValidOffset);

      return {
        validRecords: records.length,
        recoveredTail: true,
        truncatedBytes,
        lastSequence: records.length > 0 ? records[records.length - 1].sequence : 0,
        diagnostic: {
          code: "INCOMPLETE_TAIL",
          message: `Incomplete final frame detected and safely truncated (${truncatedBytes} bytes at offset ${lastValidOffset})`,
          repair: "Inspect canonical journal or re-apply uncommitted operation.",
          detail: {
            journalPath,
            lastValidOffset,
            truncatedBytes,
          },
        },
        records,
      };
    }

    records.push(parsed as FramedRecord<unknown>);
    lastValidOffset = recordEnd;
    lineStart = recordEnd;
  }

  // Check if there was trailing data after lastValidOffset that is non-whitespace
  if (lastValidOffset < buffer.length) {
    const trailing = buffer.subarray(lastValidOffset).toString("utf8").trim();
    if (trailing.length > 0) {
      const truncatedBytes = buffer.length - lastValidOffset;
      await fs.promises.truncate(journalPath, lastValidOffset);
      return {
        validRecords: records.length,
        recoveredTail: true,
        truncatedBytes,
        lastSequence: records.length > 0 ? records[records.length - 1].sequence : 0,
        diagnostic: {
          code: "INCOMPLETE_TAIL",
          message: `Incomplete final frame detected and safely truncated (${truncatedBytes} bytes at offset ${lastValidOffset})`,
          repair: "Inspect canonical journal or re-apply uncommitted operation.",
          detail: {
            journalPath,
            lastValidOffset,
            truncatedBytes,
          },
        },
        records,
      };
    }
  }

  return {
    validRecords: records.length,
    recoveredTail: false,
    truncatedBytes: 0,
    lastSequence: records.length > 0 ? records[records.length - 1].sequence : 0,
    records,
  };
}

/**
 * Rebuilds all derived projections (STATE.yaml, INDEX.md, cards/*.md) directly
 * from canonical authority records in GRAPH.jsonl.
 * All projection files are staged in temporary sibling files and atomically swapped with rename.
 */
export async function rebuildProjections(storageRoot: string): Promise<void> {
  const canonicalRoot = canonicalizePath(storageRoot);

  await withRootLock(canonicalRoot, async () => {
    const graphPath = path.join(canonicalRoot, "GRAPH.jsonl");
    const scanResult = await scanAndRecoverJournal(graphPath);

    const events: GraphEvent[] = [];
    for (const record of scanResult.records) {
      const payload = record.payload;
      const parsedEvent = GraphEventSchema.safeParse(payload);
      if (parsedEvent.success) {
        events.push(parsedEvent.data);
      } else {
        const parsedNode = NodeSchema.safeParse(payload);
        if (parsedNode.success) {
          events.push({ kind: "node", node: parsedNode.data });
        } else {
          const parsedEdge = EdgeSchema.safeParse(payload);
          if (parsedEdge.success) {
            events.push({ kind: "edge", edge: parsedEdge.data });
          }
        }
      }
    }

    const graph: MaterializedGraph = applyEvents({ nodes: [], edges: [] }, events);

    // 1. Regenerate and swap INDEX.md
    const indexPath = path.join(canonicalRoot, "INDEX.md");
    const indexContent = renderIndex(graph);
    await stageAndSwapProjection(canonicalRoot, indexPath, indexContent);

    // 2. Regenerate and swap cards/*.md
    const cardsDir = path.join(canonicalRoot, "cards");
    await fs.promises.mkdir(cardsDir, { recursive: true });
    const existingCards = await fs.promises.readdir(cardsDir);
    const validCardNames = new Set(graph.nodes.map((n) => `${n.id}.md`));
    for (const cardFile of existingCards) {
      if (cardFile.endsWith(".md") && !validCardNames.has(cardFile)) {
        await fs.promises.unlink(path.join(cardsDir, cardFile)).catch(() => {});
      }
    }
    for (const node of graph.nodes) {
      const cardPath = path.join(cardsDir, `${node.id}.md`);
      const cardContent = renderCard(node);
      await stageAndSwapProjection(canonicalRoot, cardPath, cardContent);
    }

    // 3. Regenerate and swap STATE.yaml
    const statePath = path.join(canonicalRoot, "STATE.yaml");
    let existingState: Record<string, unknown> = {};
    try {
      const rawState = await fs.promises.readFile(statePath, "utf8");
      const parsed = JSON.parse(rawState);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existingState = parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore parse failure / missing STATE.yaml
    }

    const nextState = stateForGraph(existingState, graph);
    if (!("schema_version" in nextState)) {
      nextState.schema_version = 1;
    }
    const stateContent = JSON.stringify(nextState, null, 2) + "\n";
    await stageAndSwapProjection(canonicalRoot, statePath, stateContent);
  });
}
