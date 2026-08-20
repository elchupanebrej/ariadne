#!/usr/bin/env node
import { resolve } from "node:path";
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
import { runStatus, type CliIO } from "./commands/status.js";
import { runTemplate } from "./commands/template.js";

const VERSION = "0.1.0";

const HELP = `Ariadne ${VERSION}

Usage:
  ariadne status [--json]
  ariadne node <add|get|list|remove> ...
  ariadne edge <add|list|remove> ...
  ariadne invalidate <node_id> --by <evidence_id>
  ariadne gate <structural|semantic|epistemic|all> [--strict]
  ariadne verify [--strict]
  ariadne envelope <send|receive|verify> <file>
  ariadne ingest matt <skill> <file>
  ariadne op <frame|diagnose|transform|explore|knowledge|dependencies|dynamics|value|validate>
  ariadne init [--mode auto|standalone|gsd] [--force]
  ariadne template <FRAME|DIAG|LEAN-TASK|TRANS>

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
    if (command === "invalidate") return await runInvalidation(args.slice(1), io);
    if (command === "gate") return await runGate(args.slice(1), io);
    if (command === "verify") return await runGate(["all", ...args.slice(1)], io);
    if (command === "envelope") return await runEnvelope(args.slice(1), io);
    if (command === "ingest") return await runIngest(args.slice(1), io);
    if (command === "op") return runOperation(args.slice(1), io);
    if (command === "init") return await runInit(args.slice(1), io);
    if (command === "template") return runTemplate(args.slice(1), io);
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    io.stderr.write(`Error: ${errorMessage(error)}\n`);
    return 1;
  }
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (invokedFile === resolve(fileURLToPath(import.meta.url))) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
