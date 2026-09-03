import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
import { hasHelp, resolveCliWorkspace, type CliIO } from "../workspace.js";
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

const REPORT_USAGE = "Usage: ariadne report [FRAME-id] [--json]\n";

export async function runReport(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(REPORT_USAGE);
    return 0;
  }
  const json = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  if (positional.length > 1) throw new Error(REPORT_USAGE.trim());
  const [frameArg] = positional;

  const { environment, storage, graph } = await resolveCliWorkspace(io);
  const report = await graph.report({
    cardsPrefix: toRootRelative(environment.rootPath, storage.cardsDirectory),
    rootId: frameArg,
  });

  const reportsDirectory = join(storage.rootDirectory, "reports");
  await mkdir(reportsDirectory, { recursive: true });
  const ordinal = await nextReportOrdinal(reportsDirectory);
  const slugSource = report.summary.sections[0]?.root ?? frameArg ?? "forest";
  const fileName = `${ordinal}-${slugify(slugSource)}.md`;
  await writeFile(join(reportsDirectory, fileName), report.text, "utf8");

  if (json) {
    const continuation = frameArg
      ? buildContinuation(await storage.materialize(), frameArg)
      : null;
    io.stdout.write(
      `${JSON.stringify({
        file: `${toRootRelative(environment.rootPath, reportsDirectory)}/${fileName}`,
        ...report.summary,
        ...(continuation ? { continuation } : {}),
      })}\n`,
    );
    return 0;
  }
  io.stdout.write(report.text);
  return 0;
}
