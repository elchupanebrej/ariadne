import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { toRootRelative } from "../../core/root-relative.js";
import {
  buildReport,
  nextReportOrdinal,
  slugify,
  answerText,
  LOG_TYPES,
  TOMBSTONE_STATUSES,
  type ReportOptions,
  type ReportOutput,
  type ReportSummary,
} from "../../graph/report-engine.js";
import { hasHelp, parseOptions, parseOutputFormat, syntaxError } from "../contract.js";
import { resolveCliWorkspace, type CliIO } from "../workspace.js";
import { buildContinuation } from "./status.js";

export {
  buildReport,
  nextReportOrdinal,
  slugify,
  answerText,
  LOG_TYPES,
  TOMBSTONE_STATUSES,
  type ReportOptions,
  type ReportOutput,
  type ReportSummary,
};

const REPORT_USAGE = "Usage: ariadne report [--format (json|markdown)] [--out <path>]\n";

export async function runReport(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(REPORT_USAGE);
    return 0;
  }
  const output = parseOutputFormat(args, ["json", "markdown"], "markdown", REPORT_USAGE.trim());
  const legacyJson = output.rest.includes("--json");
  const rest = output.rest.filter((arg) => arg !== "--json");
  const parsed = parseOptions(rest, [{ name: "out", takesValue: true }], REPORT_USAGE.trim());
  if (parsed.positionals.length > 1 || parsed.flags.size > 0) {
    throw syntaxError(REPORT_USAGE.trim());
  }
  const frameArg = parsed.positionals[0];
  const format = legacyJson ? "json" : output.format;
  const outPath = parsed.values.get("out");

  const { environment, storage, graph } = await resolveCliWorkspace(io);
  const report = await graph.report({
    cardsPrefix: toRootRelative(environment.rootPath, storage.cardsDirectory),
    rootId: frameArg,
  });

  const reportsDirectory = join(storage.rootDirectory, "reports");
  await mkdir(reportsDirectory, { recursive: true });
  const defaultPath = join(
    reportsDirectory,
    `${await nextReportOrdinal(reportsDirectory)}-${slugify(
      report.summary.sections[0]?.root ?? frameArg ?? "forest",
    )}.md`,
  );
  const targetPath = outPath === undefined ? defaultPath : resolve(io.cwd, outPath);
  await mkdir(dirname(targetPath), { recursive: true });

  if (format === "json") {
    const continuation = frameArg
      ? buildContinuation(await storage.materialize(), frameArg)
      : null;
    const receipt = {
      file: toRootRelative(environment.rootPath, targetPath),
      ...report.summary,
      ...(continuation ? { continuation } : {}),
    };
    await writeFile(targetPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    io.stdout.write(`${JSON.stringify(receipt)}\n`);
    return 0;
  }
  await writeFile(targetPath, report.text, "utf8");
  io.stdout.write(report.text);
  return 0;
}
