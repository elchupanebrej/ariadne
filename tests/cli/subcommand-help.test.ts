import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";

const capture = () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  return { stream, text: () => output };
};

const invoke = (args: string[], cwd?: string) => {
  const stdout = capture();
  const stderr = capture();
  const dir = cwd ?? mkdtempSync(join(tmpdir(), "ariadne-cli-help-"));
  return runCli(args, { cwd: dir, stdout: stdout.stream, stderr: stderr.stream }).then((code) => ({
    code,
    stdout: stdout.text(),
    stderr: stderr.text(),
    cwd: dir,
  }));
};

describe("subcommand and option help", () => {
  describe("group-level help", () => {
    it.each([
      ["node", "--help", "Usage: ariadne node <add|get|list|remove|update> ..."],
      ["node", "-h", "Usage: ariadne node <add|get|list|remove|update> ..."],
      ["edge", "--help", "Usage: ariadne edge <add|list|remove> ..."],
      ["edge", "-h", "Usage: ariadne edge <add|list|remove> ..."],
    ])("returns 0 and usage for %s %s without creating files", async (cmd, flag, expectedUsage) => {
      const result = await invoke([cmd, flag]);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe(expectedUsage);
      expect(result.stderr).toBe("");
      expect(readdirSync(result.cwd)).toEqual([]);
    });
  });

  describe("leaf-level subcommand help", () => {
    it.each([
      ["node", "add", "--help", "Usage: ariadne node add <type> <id> --title <title> --payload <json>"],
      ["node", "add", "-h", "Usage: ariadne node add <type> <id> --title <title> --payload <json>"],
      ["node", "get", "--help", "Usage: ariadne node get <id>"],
      ["node", "get", "-h", "Usage: ariadne node get <id>"],
      ["node", "list", "--help", "Usage: ariadne node list [--type] [--provenance]"],
      ["node", "list", "-h", "Usage: ariadne node list [--type] [--provenance]"],
      ["node", "remove", "--help", "Usage: ariadne node remove <id>"],
      ["node", "remove", "-h", "Usage: ariadne node remove <id>"],
      ["node", "update", "--help", "Usage: ariadne node update <id> [--title <title>] --payload <json>"],
      ["node", "update", "-h", "Usage: ariadne node update <id> [--title <title>] --payload <json>"],
      ["edge", "add", "--help", "Usage: ariadne edge add <from_id> <relation> <to_id>"],
      ["edge", "add", "-h", "Usage: ariadne edge add <from_id> <relation> <to_id>"],
      ["edge", "list", "--help", "Usage: ariadne edge list [--from] [--to] [--relation]"],
      ["edge", "list", "-h", "Usage: ariadne edge list [--from] [--to] [--relation]"],
      ["edge", "remove", "--help", "Usage: ariadne edge remove <from_id> <relation> <to_id>"],
      ["edge", "remove", "-h", "Usage: ariadne edge remove <from_id> <relation> <to_id>"],
    ])("returns 0 and usage for %s %s %s without creating files", async (cmd, subcmd, flag, expectedUsage) => {
      const result = await invoke([cmd, subcmd, flag]);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe(expectedUsage);
      expect(result.stderr).toBe("");
      expect(readdirSync(result.cwd)).toEqual([]);
    });

    it("returns leaf help even when options precede or follow --help", async () => {
      const result = await invoke([
        "node",
        "add",
        "ASM",
        "ASM-1",
        "--title",
        "Test title",
        "--help",
      ]);
      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe(
        "Usage: ariadne node add <type> <id> --title <title> --payload <json>",
      );
      expect(result.stderr).toBe("");
      expect(readdirSync(result.cwd)).toEqual([]);
    });
  });

  describe("other command families help", () => {
    it.each([
      [["status", "--help"], "Usage: ariadne status [--json]"],
      [["status", "-h"], "Usage: ariadne status [--json]"],
      [["gate", "--help"], "Usage: ariadne gate <structural|semantic|epistemic|decision-scope|all> [--strict]"],
      [["gate", "-h"], "Usage: ariadne gate <structural|semantic|epistemic|decision-scope|all> [--strict]"],
      [["verify", "--help"], "Usage: ariadne verify [--strict]"],
      [["verify", "-h"], "Usage: ariadne verify [--strict]"],
      [["invalidate", "--help"], "Usage: ariadne invalidate <node_id> --by <evidence_id>"],
      [["invalidate", "-h"], "Usage: ariadne invalidate <node_id> --by <evidence_id>"],
      [["envelope", "--help"], "Usage: ariadne envelope <send|receive|verify> <file>"],
      [["envelope", "-h"], "Usage: ariadne envelope <send|receive|verify> <file>"],
      [["envelope", "send", "--help"], "Usage: ariadne envelope send <file>"],
      [["envelope", "receive", "--help"], "Usage: ariadne envelope receive <file>"],
      [["envelope", "verify", "--help"], "Usage: ariadne envelope verify <file>"],
      [["ingest", "--help"], "Usage: ariadne ingest <matt|gsd> ..."],
      [["ingest", "-h"], "Usage: ariadne ingest <matt|gsd> ..."],
      [["ingest", "matt", "--help"], "Usage: ariadne ingest matt <skill> <file>"],
      [["ingest", "gsd", "--help"], "Usage: ariadne ingest gsd <path>"],
      [["op", "--help"], "Usage: ariadne op <frame|diagnose|transform|explore|knowledge|dependencies|dynamics|value|validate>"],
      [["op", "-h"], "Usage: ariadne op <frame|diagnose|transform|explore|knowledge|dependencies|dynamics|value|validate>"],
      [["init", "--help"], "Usage: ariadne init [--mode auto|standalone|gsd] [--force]"],
      [["init", "-h"], "Usage: ariadne init [--mode auto|standalone|gsd] [--force]"],
      [["template", "--help"], "Usage: ariadne template <FRAME|DIAG|LEAN-TASK|TRANS>"],
      [["template", "-h"], "Usage: ariadne template <FRAME|DIAG|LEAN-TASK|TRANS>"],
    ])("returns 0 and usage for %j without creating files", async (args, expectedUsage) => {
      const result = await invoke(args);

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe(expectedUsage);
      expect(result.stderr).toBe("");
      expect(readdirSync(result.cwd)).toEqual([]);
    });
  });

  describe("root help", () => {
    it.each([
      [["--help"]],
      [["-h"]],
      [[]],
    ])("returns 0 with root usage and empty stderr for %j", async (args) => {
      const result = await invoke(args);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("ariadne node <add|get|list|remove|update> ...");
      expect(result.stderr).toBe("");
      expect(readdirSync(result.cwd)).toEqual([]);
    });
  });

  describe("unknown options and invalid commands rejection", () => {
    it.each([
      [["node", "unknown-subcommand"], "Unknown node command: unknown-subcommand"],
      [["node", "add", "--unknown-flag"], "Unknown or incomplete option: --unknown-flag"],
      [["edge", "unknown-subcommand"], "Usage: ariadne edge <add|list|remove> ..."],
      [["edge", "list", "--unknown-flag"], "Unknown or incomplete option: --unknown-flag"],
      [["status", "--unknown-flag"], "Usage: ariadne status [--json]"],
      [["init", "--unknown-flag"], "Usage: ariadne init [--mode auto|standalone|gsd] [--force]"],
      [["unknown-command"], "Unknown command: unknown-command"],
    ])("returns 1 with error on stderr for %j", async (args, expectedError) => {
      const result = await invoke(args);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain(expectedError);
    });
  });

  describe("built executable subcommand help", () => {
    it.each([
      [["node", "--help"], "Usage: ariadne node <add|get|list|remove|update> ..."],
      [["node", "add", "--help"], "Usage: ariadne node add <type> <id> --title <title> --payload <json>"],
      [["edge", "--help"], "Usage: ariadne edge <add|list|remove> ..."],
    ])("executes built cli with %j", async (args, expectedUsage) => {
      const builtCli = resolve(
        fileURLToPath(new URL("../../dist/cli/index.js", import.meta.url)),
      );
      if (!existsSync(builtCli)) return;

      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>(
        (resolveResult, reject) => {
          const child = spawn(process.execPath, [builtCli, ...args], {
            cwd: process.cwd(),
          });
          let stdout = "";
          let stderr = "";
          child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
          });
          child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
          });
          child.on("error", reject);
          child.on("close", (code) => resolveResult({ code, stdout, stderr }));
        },
      );

      expect(result.code).toBe(0);
      expect(result.stdout.trim()).toBe(expectedUsage);
      expect(result.stderr).toBe("");
    }, 30_000);
  });
});
