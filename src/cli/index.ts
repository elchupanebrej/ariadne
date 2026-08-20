#!/usr/bin/env node
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { runEdge } from "./commands/edge.js";
import { runNode } from "./commands/node.js";
import { runStatus, type CliIO } from "./commands/status.js";

const VERSION = "0.1.0";

const HELP = `Ariadne ${VERSION}

Usage:
  ariadne status [--json]
  ariadne node <add|get|list|remove> ...
  ariadne edge <add|list|remove> ...

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
