import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("preserves packaged text bytes even when the host enables Git autocrlf", () => {
  const root = mkdtempSync(join(tmpdir(), "ariadne-checkout-bytes-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });
  const samples = {
    "SKILL.md": "---\nname: example\n---\n",
    "GRAPH.jsonl": '{"kind":"node"}\n',
    "manifest.json": '{"files":{}}\n',
  };
  try {
    git("init", "-q");
    git("config", "core.autocrlf", "true");
    writeFileSync(join(root, ".gitattributes"), readFileSync(new URL("../../.gitattributes", import.meta.url)));
    for (const [name, bytes] of Object.entries(samples)) writeFileSync(join(root, name), bytes);
    git("add", ".gitattributes", ...Object.keys(samples));
    for (const name of Object.keys(samples)) rmSync(join(root, name));
    git("checkout-index", "--all", "--force");
    for (const [name, bytes] of Object.entries(samples)) expect(readFileSync(join(root, name), "utf8")).toBe(bytes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
