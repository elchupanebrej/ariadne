#!/usr/bin/env node
import { resolve } from "node:path";
import { realpathSync } from "node:fs";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { runEdge } from "./commands/edge.js";
import { runGate } from "./commands/gate.js";
import { runInvalidation } from "./commands/invalidate.js";
import { runIngest } from "./commands/ingest.js";
import { runInit } from "./commands/init.js";
import { runNode } from "./commands/node.js";
import { runEnvelope } from "./commands/envelope.js";
import { runOperation } from "./commands/op.js";
import { runReport } from "./commands/report.js";
import { runStatus } from "./commands/status.js";
import { runTemplate } from "./commands/template.js";
import { runViz } from "./commands/viz.js";
import { runMergeDriver } from "./commands/merge.js";
import { runMergeResolve } from "./commands/merge-resolve.js";
import { runMergeDoctor, runMergeSetup } from "./commands/merge-integration.js";
import { runMergeCheck } from "./commands/merge-check.js";
import { runMergeSync } from "./commands/merge-sync.js";
import { hasHelp, type CliIO } from "./workspace.js";

const VERSION = "0.1.0";

const HELP = `Ariadne ${VERSION}

Usage:
  ariadne status [FRAME-id] [--json]
  ariadne node <add|get|list|remove|update> ...
  ariadne edge <add|list|remove> ...
  ariadne invalidate <node_id> --by <evidence_id>
  ariadne gate <structural|semantic|epistemic|decision-scope|all> [--strict]
  ariadne verify [--strict]
  ariadne envelope <send|receive|verify> <file>
  ariadne ingest matt <skill> <file>
  ariadne ingest gsd <path>
  ariadne op <frame|diagnose|transform|explore|knowledge|dependencies|dynamics|value|validate>
  ariadne report [FRAME-id] [--json]
  ariadne viz [FRAME-id] [--json]
  ariadne init [--mode auto|standalone|gsd] [--force]
  ariadne template <FRAME|DIAG|LEAN-TASK|TRANS>
  ariadne merge-driver [--json] <ancestor> <current> <incoming>
  ariadne merge-resolve <conflict-id> --expected-digest <digest> (--select-digest <digest> | --delta <file>) [--json]
  ariadne merge-setup [--json]
  ariadne merge-doctor [--json]
  ariadne merge-check [--json]
  ariadne merge-sync [--json] [--stage-derived]

Options:
  -h, --help       Show this help
  -v, --version    Show the CLI version
`;

export type RunCliOptions = {
  cwd?: string;
  stdout?: Writable;
  stderr?: Writable;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function runCli(
  args: readonly string[],
  options: RunCliOptions = {},
): Promise<number> {
  const io: CliIO = {
    cwd: options.cwd ?? process.cwd(),
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
  };
  const command = args[0];

  try {
    if (!command || command === "--help" || command === "-h") {
      io.stdout.write(HELP);
      return 0;
    }
    if (command === "--version" || command === "-v") {
      io.stdout.write(`${VERSION}\n`);
      return 0;
    }
    if (command === "status") return await runStatus(args.slice(1), io);
    if (command === "node") return await runNode(args.slice(1), io);
    if (command === "edge") return await runEdge(args.slice(1), io);
    if (command === "invalidate")
      return await runInvalidation(args.slice(1), io);
    if (command === "gate") return await runGate(args.slice(1), io);
    if (command === "verify") {
      if (hasHelp(args.slice(1))) {
        io.stdout.write("Usage: ariadne verify [--strict]\n");
        return 0;
      }
      return await runGate(["all", ...args.slice(1)], io);
    }
    if (command === "envelope") return await runEnvelope(args.slice(1), io);
    if (command === "ingest") return await runIngest(args.slice(1), io);
    if (command === "report") return await runReport(args.slice(1), io);
    if (command === "viz") return await runViz(args.slice(1), io);
    if (command === "op") return runOperation(args.slice(1), io);
    if (command === "init") return await runInit(args.slice(1), io);
    if (command === "template") return runTemplate(args.slice(1), io);
    if (command === "merge-driver")
      return await runMergeDriver(args.slice(1), io);
    if (command === "merge-resolve")
      return await runMergeResolve(args.slice(1), io);
    if (command === "merge-setup")
      return await runMergeSetup(args.slice(1), io);
    if (command === "merge-doctor")
      return await runMergeDoctor(args.slice(1), io);
    if (command === "merge-check")
      return await runMergeCheck(args.slice(1), io);
    if (command === "merge-sync") return await runMergeSync(args.slice(1), io);
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    io.stderr.write(`Error: ${errorMessage(error)}\n`);
    return 1;
  }
}

const invokedFile = process.argv[1] ? realpathSync(process.argv[1]) : undefined;
if (invokedFile === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
