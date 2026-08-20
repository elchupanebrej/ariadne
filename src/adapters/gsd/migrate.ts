import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type StandaloneMigrationReceipt = {
  rootDirectory: string;
  planningRoot: string;
  overlayRoot: string;
  copiedDocuments: string[];
  mergedFiles: string[];
  preservedDocuments: string[];
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const sourceFor = async (root: string, name: string): Promise<string | undefined> => {
  for (const path of [join(root, name), join(root, ".ariadne", name)]) {
    if (await exists(path)) return path;
  }
  return undefined;
};

const copyWhenAbsent = async (
  source: string | undefined,
  target: string,
): Promise<"copied" | "preserved" | undefined> => {
  if (!source) return undefined;
  if (await exists(target)) return "preserved";
  await writeFile(target, await readFile(source));
  return "copied";
};

const contentLines = (value: string): string[] =>
  value.split("\n").filter((line) => line.trim().length > 0);

const mergeLineFile = async (source: string, target: string): Promise<boolean> => {
  if (!(await exists(source))) return false;
  const sourceLines = contentLines(await readFile(source, "utf8"));
  if (sourceLines.length === 0) return false;
  if (!(await exists(target))) {
    await writeFile(target, `${sourceLines.join("\n")}\n`, "utf8");
    return true;
  }

  const targetLines = contentLines(await readFile(target, "utf8"));
  const present = new Set(targetLines);
  const additions = sourceLines.filter((line) => !present.has(line));
  if (additions.length === 0) return false;

  await writeFile(target, `${[...targetLines, ...additions].join("\n")}\n`, "utf8");
  return true;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const mergeState = async (source: string, target: string): Promise<boolean> => {
  if (!(await exists(source))) return false;
  const sourceText = await readFile(source, "utf8");
  if (!(await exists(target))) {
    await writeFile(target, sourceText, "utf8");
    return true;
  }

  const targetText = await readFile(target, "utf8");
  try {
    const sourceValue: unknown = JSON.parse(sourceText);
    const targetValue: unknown = JSON.parse(targetText);
    if (isRecord(sourceValue) && isRecord(targetValue)) {
      const merged = { ...sourceValue, ...targetValue };
      const conflicts = Object.fromEntries(
        Object.keys(sourceValue)
          .filter(
            (key) =>
              key in targetValue &&
              JSON.stringify(sourceValue[key]) !== JSON.stringify(targetValue[key]),
          )
          .map((key) => [key, sourceValue[key]]),
      );
      if (Object.keys(conflicts).length > 0) {
        const previous = isRecord(targetValue._standalone_migration)
          ? targetValue._standalone_migration
          : {};
        merged._standalone_migration = { ...previous, conflicts };
      }
      const serialized = `${JSON.stringify(merged, null, 2)}\n`;
      if (serialized === targetText) return false;
      await writeFile(target, serialized, "utf8");
      return true;
    }
  } catch {
    // Keep opaque state lossless below when a host uses YAML rather than JSON.
  }

  const trimmed = sourceText.trim();
  if (!trimmed || targetText.includes(trimmed)) return false;
  const migrated = [
    targetText.trimEnd(),
    "",
    "# Migrated standalone STATE.yaml (preserved source)",
    ...trimmed.split("\n").map((line) => `# ${line}`),
    "",
  ].join("\n");
  await writeFile(target, migrated, "utf8");
  return true;
};

/** Project standalone Ariadne-owned artifacts into an existing or new GSD root. */
export async function migrateStandaloneToGsd(
  rootDirectory = process.cwd(),
): Promise<StandaloneMigrationReceipt> {
  const root = resolve(rootDirectory);
  const planningRoot = join(root, ".planning");
  const overlayRoot = join(planningRoot, "ariadne");
  await mkdir(overlayRoot, { recursive: true });

  const copiedDocuments: string[] = [];
  const preservedDocuments: string[] = [];
  for (const name of ["PROJECT.md", "REQUIREMENTS.md", "CONTEXT.md"] as const) {
    const source = await sourceFor(root, name);
    const result = await copyWhenAbsent(source, join(planningRoot, name));
    if (result === "copied") copiedDocuments.push(name);
    if (result === "preserved") preservedDocuments.push(name);
  }

  const standaloneRoot = join(root, ".ariadne");
  const mergedFiles: string[] = [];
  if (await mergeLineFile(join(standaloneRoot, "GRAPH.jsonl"), join(overlayRoot, "GRAPH.jsonl"))) {
    mergedFiles.push("GRAPH.jsonl");
  }
  if (await mergeState(join(standaloneRoot, "STATE.yaml"), join(overlayRoot, "STATE.yaml"))) {
    mergedFiles.push("STATE.yaml");
  }
  if (await mergeLineFile(join(standaloneRoot, "NOTICES.jsonl"), join(overlayRoot, "NOTICES.jsonl"))) {
    mergedFiles.push("NOTICES.jsonl");
  }

  return {
    rootDirectory: root,
    planningRoot,
    overlayRoot,
    copiedDocuments,
    mergedFiles,
    preservedDocuments,
  };
}

export const migrateStandaloneWorkspace = migrateStandaloneToGsd;
