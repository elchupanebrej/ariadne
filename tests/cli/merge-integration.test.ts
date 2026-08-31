import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";

const exec = promisify(execFile);

const git = async (cwd: string, ...args: string[]): Promise<string> =>
  (await exec("git", args, { cwd })).stdout;

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

const repository = async (): Promise<string> => {
  const repo = await mkdtemp(join("/tmp", "ariadne-merge-integration-"));
  await git(repo, "init", "-q");
  await git(repo, "config", "user.email", "test@example.com");
  await git(repo, "config", "user.name", "Ariadne Test");
  await mkdir(join(repo, ".ariadne"));
  await writeFile(join(repo, ".ariadne", "GRAPH.jsonl"), "");
  return repo;
};

const run = async (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  const code = await runCli(args, {
    cwd,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
};

describe("Ariadne Git merge integration", () => {
  it("installs idempotently without changing unrelated local Git config", async () => {
    const repo = await repository();
    try {
      await git(repo, "config", "user.signingkey", "keep-me");
      const first = await run(repo, ["merge-setup", "--json"]);
      expect(first.code).toBe(0);
      const attributes = await readFile(join(repo, ".gitattributes"), "utf8");
      const driver = await git(
        repo,
        "config",
        "--local",
        "--get",
        "merge.ariadne.driver",
      );
      const second = await run(repo, ["merge-setup", "--json"]);
      expect(second.code).toBe(0);
      expect(await readFile(join(repo, ".gitattributes"), "utf8")).toBe(
        attributes,
      );
      expect(
        await git(repo, "config", "--local", "--get", "user.signingkey"),
      ).toBe("keep-me\n");
      expect(
        await git(repo, "config", "--local", "--get", "merge.ariadne.driver"),
      ).toBe(driver);
      expect(attributes).toBe(
        ".ariadne/GRAPH.jsonl merge=ariadne\n" +
          ".ariadne/INDEX.md merge=ours\n" +
          ".ariadne/cards/** merge=ours\n",
      );
      expect(driver).toContain("merge-driver --protocol-version 1 %O %A %B");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);

  it("leaves incompatible attributes and driver configuration unchanged", async () => {
    const repo = await repository();
    try {
      await writeFile(
        join(repo, ".gitattributes"),
        ".ariadne/GRAPH.jsonl merge=ours\n",
      );
      await git(
        repo,
        "config",
        "--local",
        "merge.ariadne.driver",
        "node incompatible-driver %O %A %B",
      );
      const result = await run(repo, ["merge-setup", "--json"]);
      expect(result.code).toBe(1);
      expect(await readFile(join(repo, ".gitattributes"), "utf8")).toBe(
        ".ariadne/GRAPH.jsonl merge=ours\n",
      );
      expect(
        await git(repo, "config", "--local", "--get", "merge.ariadne.driver"),
      ).toBe("node incompatible-driver %O %A %B\n");
      expect(result.stderr).toMatch(/manual integration/i);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("rejects a driver with reordered Git placeholders", async () => {
    const repo = await repository();
    try {
      await git(
        repo,
        "config",
        "--local",
        "merge.ariadne.driver",
        "node driver merge-driver --protocol-version 1 %A %O %B",
      );
      const result = await run(repo, ["merge-setup", "--json"]);
      expect(result.code).toBe(1);
      expect(
        await git(repo, "config", "--local", "--get", "merge.ariadne.driver"),
      ).toBe("node driver merge-driver --protocol-version 1 %A %O %B\n");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("rejects a compatible-looking driver with the wrong Ariadne entry point", async () => {
    const repo = await repository();
    try {
      await git(
        repo,
        "config",
        "--local",
        "merge.ariadne.driver",
        `${process.execPath} /tmp/other-cli.js merge-driver --protocol-version 1 %O %A %B`,
      );
      const result = await run(repo, ["merge-setup", "--json"]);
      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(
        /this Ariadne executable and CLI entry point/i,
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("uses the GSD overlay as the canonical graph path", async () => {
    const repo = await repository();
    try {
      await rm(join(repo, ".ariadne"), { recursive: true, force: true });
      await mkdir(join(repo, ".planning", "ariadne"), { recursive: true });
      const result = await run(repo, ["merge-setup", "--json"]);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        graph_path: ".planning/ariadne/GRAPH.jsonl",
      });
      expect(await readFile(join(repo, ".gitattributes"), "utf8")).toBe(
        ".planning/ariadne/GRAPH.jsonl merge=ariadne\n" +
          ".planning/ariadne/INDEX.md merge=ours\n" +
          ".planning/ariadne/cards/** merge=ours\n",
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("doctor passes only after the repository attributes are committed", async () => {
    const repo = await repository();
    try {
      expect((await run(repo, ["merge-doctor"])).code).toBe(1);
      expect((await run(repo, ["merge-setup"])).code).toBe(0);
      expect((await run(repo, ["merge-doctor"])).code).toBe(1);
      await git(repo, "add", ".gitattributes", ".githooks");
      await git(repo, "commit", "-qm", "install merge integration");
      const doctor = await run(repo, ["merge-doctor", "--json"]);
      expect(doctor.code).toBe(0);
      expect(JSON.parse(doctor.stdout)).toMatchObject({
        passed: true,
        protocol_version: 1,
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);
});
