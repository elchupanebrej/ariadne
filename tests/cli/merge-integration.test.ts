import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("adds only the missing managed attribute when integration is partially present", async () => {
    const repo = await repository();
    try {
      const existing =
        "# repository policy\n" +
        ".ariadne/GRAPH.jsonl merge=ariadne\n" +
        ".ariadne/INDEX.md merge=ours\n";
      await writeFile(join(repo, ".gitattributes"), existing);

      const result = await run(repo, ["merge-setup", "--json"]);

      expect(result.code).toBe(0);
      expect(await readFile(join(repo, ".gitattributes"), "utf8")).toBe(
        `${existing}.ariadne/cards/** merge=ours\n`,
      );
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

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

  it("reports an actionable JSON diagnosis before the repository has a commit", async () => {
    const repo = await repository();
    try {
      const before = await git(repo, "status", "--porcelain");
      const result = await run(repo, ["merge-doctor", "--json"]);

      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        passed: false,
        checks: {
          committed_attributes: { passed: false },
          local_driver: { passed: false },
          executable: { passed: false },
          protocol: { passed: false },
          hooks: { passed: false },
        },
      });
      expect(result.stderr).toMatch(/committed \.gitattributes is missing/i);
      expect(await git(repo, "status", "--porcelain")).toBe(before);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("fails closed with an actionable diagnosis in a fresh clone", async () => {
    const source = await repository();
    const clone = await mkdtemp(join("/tmp", "ariadne-merge-clone-"));
    try {
      expect((await run(source, ["merge-setup"])).code).toBe(0);
      await git(source, "add", ".ariadne/GRAPH.jsonl", ".gitattributes", ".githooks");
      await git(source, "commit", "-qm", "install merge integration");
      await git(clone, "clone", "-q", source, clone);

      const graphBefore = await readFile(join(clone, ".ariadne", "GRAPH.jsonl"), "utf8");
      const statusBefore = await git(clone, "status", "--porcelain");
      const result = await run(clone, ["merge-doctor", "--json"]);

      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        passed: false,
        checks: {
          committed_attributes: { passed: true },
          local_driver: { passed: false, message: expect.stringMatching(/missing/i) },
          hooks: { passed: false },
        },
      });
      expect(result.stderr).toMatch(/local merge driver is missing|core\.hooksPath/i);
      expect(await readFile(join(clone, ".ariadne", "GRAPH.jsonl"), "utf8")).toBe(graphBefore);
      expect(await git(clone, "status", "--porcelain")).toBe(statusBefore);
    } finally {
      await rm(source, { recursive: true, force: true });
      await rm(clone, { recursive: true, force: true });
    }
  }, 15_000);

  it("rejects an incompatible protocol before changing the Git result file", async () => {
    const repo = await repository();
    try {
      const basePath = join(repo, "base.jsonl");
      const currentPath = join(repo, "current.jsonl");
      const incomingPath = join(repo, "incoming.jsonl");
      await writeFile(basePath, "");
      await writeFile(currentPath, "current bytes\n");
      await writeFile(incomingPath, "incoming bytes\n");

      const result = await run(repo, [
        "merge-driver",
        "--json",
        "--protocol-version",
        "2",
        basePath,
        currentPath,
        incomingPath,
      ]);

      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        outcome: "FAILED",
        merge_protocol_version: 2,
        diagnostics: [
          expect.objectContaining({ code: "UNSUPPORTED_MERGE_PROTOCOL" }),
        ],
      });
      expect(await readFile(currentPath, "utf8")).toBe("current bytes\n");
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("keeps global Git configuration and repository history untouched", async () => {
    const repo = await repository();
    const globalConfig = join(repo, "global.gitconfig");
    const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = globalConfig;
    try {
      await git(repo, "config", "--global", "merge.ariadne.driver", "keep-global");
      await git(repo, "remote", "add", "origin", "https://127.0.0.1:1/never-contacted.git");
      await git(repo, "add", ".ariadne/GRAPH.jsonl");
      await git(
        repo,
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-qm",
        "initial repository state",
      );
      const globalBefore = await readFile(globalConfig, "utf8");
      const commitsBefore = await git(repo, "rev-list", "--count", "HEAD");

      const result = await run(repo, ["merge-setup", "--json"]);

      expect(result.code).toBe(0);
      expect(await readFile(globalConfig, "utf8")).toBe(globalBefore);
      expect(await git(repo, "rev-list", "--count", "HEAD")).toBe(commitsBefore);
      expect(await git(repo, "config", "--local", "--get", "merge.ariadne.driver")).not.toBe(
        "keep-global\n",
      );
    } finally {
      if (previousGlobalConfig === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);

  it("preserves incompatible higher-priority attributes for generated projections", async () => {
    const repo = await repository();
    try {
      await writeFile(
        join(repo, ".git", "info", "attributes"),
        ".ariadne/INDEX.md merge=theirs\n",
      );

      const result = await run(repo, ["merge-setup", "--json"]);

      expect(result.code).toBe(1);
      expect(await readFile(join(repo, ".git", "info", "attributes"), "utf8")).toBe(
        ".ariadne/INDEX.md merge=theirs\n",
      );
      await expect(readFile(join(repo, ".gitattributes"))).rejects.toThrow();
      expect(result.stderr).toMatch(/\.ariadne\/INDEX\.md.*manual integration/i);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("reports a non-executable existing hook without overwriting repository policy", async () => {
    const repo = await repository();
    try {
      await mkdir(join(repo, ".githooks"), { recursive: true });
      for (const name of ["pre-merge-commit", "pre-commit"]) {
        await writeFile(
          join(repo, ".githooks", name),
          "#!/bin/sh\n# ariadne-merge-hook-v1\n",
        );
      }
      await git(repo, "config", "--local", "core.hooksPath", ".githooks");

      const result = await run(repo, ["merge-setup", "--json"]);

      expect(result.code).toBe(1);
      expect(await readFile(join(repo, ".githooks", "pre-commit"), "utf8")).toBe(
        "#!/bin/sh\n# ariadne-merge-hook-v1\n",
      );
      await expect(readFile(join(repo, ".gitattributes"))).rejects.toThrow();
      expect(result.stderr).toContain(
        "Existing .githooks/pre-merge-commit is not executable",
      );
      expect(result.stderr).toMatch(/not executable.*manual integration/i);
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("refuses an executable hook that carries the marker but omits synchronization", async () => {
    const repo = await repository();
    try {
      await mkdir(join(repo, ".githooks"), { recursive: true });
      for (const name of ["pre-merge-commit", "pre-commit"]) {
        const path = join(repo, ".githooks", name);
        await writeFile(
          path,
          "#!/bin/sh\n# ariadne-merge-hook-v1\nexit 0\n",
        );
        await chmod(path, 0o755);
      }
      await git(repo, "config", "--local", "core.hooksPath", ".githooks");

      const result = await run(repo, ["merge-setup", "--json"]);

      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(/incompatible.*manual integration/i);
      expect(await readFile(join(repo, ".githooks", "pre-commit"), "utf8")).toBe(
        "#!/bin/sh\n# ariadne-merge-hook-v1\nexit 0\n",
      );
      await expect(readFile(join(repo, ".gitattributes"))).rejects.toThrow();
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });

  it("diagnoses missing Ariadne on PATH without blocking the hook", async () => {
    const repo = await repository();
    const emptyPath = await mkdtemp(join("/tmp", "ariadne-empty-path-"));
    try {
      expect((await run(repo, ["merge-setup"])).code).toBe(0);
      const result = await exec(
        join(repo, ".githooks", "pre-commit"),
        [],
        { cwd: repo, env: { ...process.env, PATH: emptyPath } },
      );

      expect(result.stderr).toMatch(
        /merge synchronization unavailable.*not on PATH/i,
      );
      expect(result.stderr).toContain("merge-sync --stage-derived");
    } finally {
      await rm(repo, { recursive: true, force: true });
      await rm(emptyPath, { recursive: true, force: true });
    }
  });

  it("rejects marker and synchronization text that is not an active hook shape", async () => {
    const repo = await repository();
    try {
      await mkdir(join(repo, ".githooks"), { recursive: true });
      for (const name of ["pre-merge-commit", "pre-commit"]) {
        const path = join(repo, ".githooks", name);
        await writeFile(
          path,
          "#!/bin/sh\n" +
            "# ariadne-merge-hook-v1\n" +
            "# ariadne merge-sync --stage-derived >&2 || true\n" +
            "echo \"ariadne merge-sync --stage-derived\"\n" +
            "exit 0\n",
        );
        await chmod(path, 0o755);
      }
      await git(repo, "config", "--local", "core.hooksPath", ".githooks");

      const result = await run(repo, ["merge-setup", "--json"]);

      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(/incompatible.*manual integration/i);
      await expect(readFile(join(repo, ".gitattributes"))).rejects.toThrow();
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  });
});
