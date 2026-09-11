/**
 * Startup integrity scan, torn write tail recovery, and projection repair engine.
 */

import fs from "node:fs";
import path from "node:path";
import { AriadneError } from "../core/errors.js";
import { canonicalizePath } from "../core/containment.js";
import {
  scanFramedJournal,
  stageAndSwapProjection,
  type JournalScanOptions,
  type JournalScanResult,
} from "./journal.js";
import { withRootLock } from "./lock.js";
import { OperationalNoticeSchema } from "../adapters/gsd/operational-notice.js";
import {
  parseGraphEventPayload,
  renderIndex,
  renderCard,
  applyEvents,
  stateForGraph,
  type MaterializedGraph,
  type GraphEvent,
} from "./domain.js";

export type { JournalScanDiagnostic, JournalScanResult } from "./journal.js";

/**
 * Scans a canonical journal (e.g. GRAPH.jsonl or NOTICES.jsonl) and verifies each frame.
 * If the final record at EOF is provably incomplete JSON from a torn write, it safely truncates
 * the file back to the last verified frame offset using fs.promises.truncate and returns a recovery
 * result with recoveredTail: true, byte count truncated, and an INCOMPLETE_TAIL diagnostic.
 * A complete frame with invalid framing, checksums, sequence, or payload schema is never truncated.
 *
 * Any corruption, checksum mismatch, schema invalidity, or sequence break in a complete frame—whether
 * before or at the final record—is persisted evidence: automatic truncation is strictly prohibited and
 * it immediately throws AriadneError(CORRUPT_PERSISTED_HISTORY).
 */
export async function scanAndRecoverJournal(
  journalPath: string,
  options: Omit<JournalScanOptions, "repair"> = {},
): Promise<JournalScanResult> {
  const authority = options.authority ?? path.basename(journalPath);
  const validatePayload = options.validatePayload ?? (
    authority === "GRAPH.jsonl"
      ? (payload: unknown) => parseGraphEventPayload(payload) !== undefined
      : authority === "NOTICES.jsonl"
        ? (payload: unknown) => OperationalNoticeSchema.safeParse(payload).success
        : undefined
  );
  return scanFramedJournal(journalPath, {
    ...options,
    authority,
    validatePayload,
    repair: true,
  });
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
    const scanResult = await scanFramedJournal(graphPath, {
      repair: true,
      workspaceRoot: canonicalRoot,
      authority: "GRAPH.jsonl",
      validatePayload: (payload) => parseGraphEventPayload(payload) !== undefined,
    });

    const events: GraphEvent[] = scanResult.records.map((record, index) => {
      const event = parseGraphEventPayload(record.payload);
      // scanFramedJournal already performed this validation. Keeping the
      // explicit guard makes the projection input boundary fail closed if the
      // validator and mapper ever drift apart.
      if (!event) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: "Canonical graph payload failed schema validation during projection rebuild.",
          repair: "Inspect the canonical authority or restore it from a trusted backup before retrying.",
          detail: {
            workspace: canonicalRoot,
            authority: "GRAPH.jsonl",
            recordLocation: { line: index + 1 },
            failureClass: "record_schema",
            safeNextAction: "Inspect the canonical authority or restore it from a trusted backup before retrying.",
          },
        });
      }
      return event;
    });

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
