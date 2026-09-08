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

  const hasLegacyAuthority = async (fileName: string): Promise<boolean> => {
    try {
      const content = await fs.promises.readFile(path.join(canonicalRoot, fileName), "utf8");
      const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
      let hasFramedRecord = false;
      for (const [index, line] of lines.entries()) {
        try {
          const parsed: unknown = JSON.parse(line);
          if (
            !parsed ||
            typeof parsed !== "object" ||
            !("schemaVersion" in parsed) ||
            (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
          ) {
            return true;
          }
          hasFramedRecord = true;
        } catch {
          // A torn final line in an otherwise framed authority is repaired by
          // the startup scan; it is not evidence of a v0 workspace.
          return index === lines.length - 1 && hasFramedRecord ? false : true;
        }
      }
      return false;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  };

  // Inspect every canonical authority before deciding. Returning after GRAPH.jsonl
  // used to let a legacy NOTICES.jsonl slip through the mutation gate.
  if (await hasLegacyAuthority("GRAPH.jsonl")) return true;
  if (await hasLegacyAuthority("NOTICES.jsonl")) return true;

  const hasCanonicalAuthorityFile = await Promise.all(["GRAPH.jsonl", "NOTICES.jsonl"].map(async (fileName) => {
    try {
      await fs.promises.access(path.join(canonicalRoot, fileName));
      return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  })).then((values) => values.some(Boolean));

  // Check STATE.yaml. An unversioned state-only directory is still a fresh
  // initialization target; canonical authorities determine persisted history
  // format, while host-owned state overlays may remain schema-less.
  const statePath = path.join(canonicalRoot, "STATE.yaml");
  try {
    const stateContent = await fs.promises.readFile(statePath, "utf8");
    if (stateContent.trim().length > 0) {
      try {
        const parsed = JSON.parse(stateContent);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (!hasCanonicalAuthorityFile && !("schema_version" in parsed) && !("schemaVersion" in parsed)) {
            return true;
          }
        } else {
          return !hasCanonicalAuthorityFile;
        }
      } catch {
        if (!hasCanonicalAuthorityFile && !stateContent.includes("schema_version") && !stateContent.includes("schemaVersion")) {
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
