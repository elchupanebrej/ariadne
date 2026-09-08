/**
 * Legacy workspace detection and mutation protection gate.
 * Gating ensures unversioned v0 workspaces are strictly read-only
 * until explicitly upgraded via 'ariadne migrate'.
 */

import fs from "node:fs";
import path from "node:path";
import { AriadneError } from "../core/errors.js";
import { canonicalizePath } from "../core/containment.js";

/**
 * Detects whether a workspace contains legacy v0 structures lacking format version metadata
 * (e.g. GRAPH.jsonl containing unversioned/naked records, or missing schemaVersion: 1 in records).
 * Empty or new storage roots are not legacy workspaces.
 */
export async function isLegacyWorkspace(storageRoot: string): Promise<boolean> {
  let canonicalRoot: string;
  try {
    canonicalRoot = canonicalizePath(storageRoot);
  } catch {
    return false;
  }

  try {
    await fs.promises.access(canonicalRoot);
  } catch {
    return false;
  }

  // Check GRAPH.jsonl
  const graphPath = path.join(canonicalRoot, "GRAPH.jsonl");
  try {
    const graphContent = await fs.promises.readFile(graphPath, "utf8");
    const lines = graphContent.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length > 0) {
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (!parsed || typeof parsed !== "object") {
            return true;
          }
          if (!("schemaVersion" in parsed) || parsed.schemaVersion !== 1) {
            return true;
          }
        } catch {
          return true;
        }
      }
      // All present records have schemaVersion === 1
      return false;
    }
  } catch (err: unknown) {
    if (
      !(
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "ENOENT"
      )
    ) {
      throw err;
    }
  }

  // Check NOTICES.jsonl
  const noticesPath = path.join(canonicalRoot, "NOTICES.jsonl");
  try {
    const noticesContent = await fs.promises.readFile(noticesPath, "utf8");
    const lines = noticesContent.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length > 0) {
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (!parsed || typeof parsed !== "object") {
            return true;
          }
          if (!("schemaVersion" in parsed) || parsed.schemaVersion !== 1) {
            return true;
          }
        } catch {
          return true;
        }
      }
      return false;
    }
  } catch (err: unknown) {
    if (
      !(
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "ENOENT"
      )
    ) {
      throw err;
    }
  }

  // Check STATE.yaml
  const statePath = path.join(canonicalRoot, "STATE.yaml");
  try {
    const stateContent = await fs.promises.readFile(statePath, "utf8");
    if (stateContent.trim().length > 0) {
      try {
        const parsed = JSON.parse(stateContent);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (!("schema_version" in parsed) && !("schemaVersion" in parsed)) {
            return true;
          }
        } else {
          return true;
        }
      } catch {
        if (!stateContent.includes("schema_version") && !stateContent.includes("schemaVersion")) {
          return true;
        }
      }
    }
  } catch (err: unknown) {
    if (
      !(
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "ENOENT"
      )
    ) {
      throw err;
    }
  }

  return false;
}

/**
 * Asserts that the storage root is not a legacy (v0) workspace.
 * Throws AriadneError(MIGRATION_REQUIRED) if a legacy workspace is detected.
 */
export async function assertNotLegacyWorkspace(storageRoot: string): Promise<void> {
  const legacy = await isLegacyWorkspace(storageRoot);
  if (legacy) {
    throw new AriadneError({
      code: "MIGRATION_REQUIRED",
      message: "Legacy (v0) workspace detected; mutation prohibited until migration.",
      repair: "Run 'ariadne migrate' to upgrade the workspace format.",
      detail: {
        storageRoot,
      },
    });
  }
}
