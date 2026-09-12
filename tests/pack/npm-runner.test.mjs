import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { npmRunner } from "../../scripts/lib/npm-runner.mjs";

const temporaryRoots = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it("runs the npm JavaScript entry without a shell, preserving argument boundaries", () => {
  const root = mkdtempSync(join(tmpdir(), "ariadne npm & runner-"));
  temporaryRoots.push(root);
  const entry = join(root, "npm-cli.js");
  writeFileSync(entry, "console.log(JSON.stringify(process.argv.slice(2)))");
  const runner = npmRunner({ npm_execpath: entry }, "win32");
  const args = ["a path with spaces", "literal&argument", "%NOT_AN_ENV_VAR%"];
  expect(JSON.parse(execFileSync(runner.cmd, [...runner.prefixArgs, ...args], { encoding: "utf8", shell: false }))).toEqual(args);
});

it("resolves the Windows npm entry beside its PATH shim for standalone invocation", () => {
  const root = mkdtempSync(join(tmpdir(), "ariadne-npm-path-"));
  temporaryRoots.push(root);
  const bin = join(root, "node_modules", "npm", "bin");
  mkdirSync(bin, { recursive: true });
  const entry = join(bin, "npm-cli.js");
  writeFileSync(entry, "");
  writeFileSync(join(root, "npm.cmd"), "@echo off");
  expect(npmRunner({ Path: root }, "win32")).toEqual({ cmd: process.execPath, prefixArgs: [entry] });
});

it("fails clearly if Windows npm cannot be resolved instead of spawning a cmd shim", () => {
  expect(() => npmRunner({ Path: "" }, "win32")).toThrow(/npm.*entry/i);
});
