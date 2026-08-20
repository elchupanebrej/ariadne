import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emitGsdOperationalNotice,
} from "../../src/adapters/gsd/operational-notice.js";
import { projectGsd } from "../../src/adapters/gsd/projector.js";
import { normalizeMattArtifact } from "../../src/adapters/matt/ingest.js";
import { generateHandoff } from "../../src/adapters/handoff/generator.js";
import { AriadneHarnessController } from "../../src/harness/controller.js";
import { NodeSchema } from "../../src/core/schemas/nodes.js";
import { propagateInvalidation } from "../../src/graph/invalidation.js";
import type { MaterializedGraph } from "../../src/graph/storage.js";
import { runInit } from "../../src/cli/commands/init.js";
import { migrateStandaloneToGsd } from "../../src/adapters/gsd/migrate.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const builtCli = resolve(repoRoot, "dist/cli/index.js");

const gsdFiles = async (root: string): Promise<void> => {
  await mkdir(join(root, ".planning"), { recursive: true });
  await writeFile(join(root, ".planning", "PROJECT.md"), "# Project\n");
  await writeFile(join(root, ".planning", "REQUIREMENTS.md"), "# Requirements\n");
  await writeFile(join(root, ".planning", "ROADMAP.md"), "# Roadmap\n");
};

const temporaryRoot = () => mkdtemp(join(tmpdir(), "ariadne-acceptance-"));

const invokeCli = (root: string, ...args: string[]): string =>
  execFileSync(process.execPath, [builtCli, ...args], {
    cwd: root,
    encoding: "utf8",
  });

describe("normative acceptance scenarios A-J", () => {
  it("A: routes model-invoked framing to the requirement/mechanism contract", async () => {
    const skill = await readFile(join(repoRoot, ".agents", "skills", "ariadne", "SKILL.md"), "utf8");
    const frame = await readFile(join(repoRoot, ".agents", "skills", "ariadne", "rules", "10-frame.md"), "utf8");

    expect(skill).toContain("rules/10-frame.md");
    expect(frame).toMatch(/behavioral requirement/i);
    expect(frame).toMatch(/mechanism/i);
  });

  it("B: projects locked GSD D-03 as DECIDED without reopening it", async () => {
    const root = await temporaryRoot();
    try {
      await gsdFiles(root);
      await writeFile(
        join(root, ".planning", "CONTEXT.md"),
        "## Decisions\n- D-03: Keep GSD operational files canonical.\n",
      );

      const projection = await projectGsd(root);
      expect(projection.decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "DEC-D-03",
            provenance_type: "DECIDED",
            status: "LOCKED",
          }),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("C: normalizes a red diagnosing-bugs artifact as measured EVD", () => {
    const evidence = normalizeMattArtifact("diagnosing-bugs", {
      statement: "The reproducible test fails under the observed regression.",
      red_capable: true,
      executed: true,
      verdict: "FALSIFIED",
      method: "vitest",
      rung: 3,
      test_command: "npm test -- regression",
      stdout_digest: "sha256:acceptance-c",
      reproducible_environment: "node-22/linux-x64",
      result: "failed",
      stdout: "expected 1, received 0",
    });

    expect(NodeSchema.parse(evidence)).toMatchObject({
      type: "EVD",
      provenance_type: "MEASURED",
    });
  });

  it("D: emits a handoff that recommends /to-spec without invoking it", async () => {
    const root = await temporaryRoot();
    try {
      const artifact = await generateHandoff(
        "DEC-001",
        {
          nodes: [
            {
              id: "DEC-001",
              type: "DEC",
              provenance_type: "DECIDED",
              statement: "Select the durable mechanism.",
              change_radius: "high",
            },
          ],
          edges: [],
        },
        { rootDirectory: root },
      );

      expect(artifact.recommendedCommand).toBe("/to-spec");
      expect(artifact.content).toContain("/to-spec");
      expect(existsSync(join(root, ".planning"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("E: invalidates CAN-002 and emits a notice without touching SUMMARY.md", async () => {
    const root = await temporaryRoot();
    try {
      const summaryPath = join(root, ".planning", "phases", "01-foundation", "SUMMARY.md");
      await mkdir(dirname(summaryPath), { recursive: true });
      await writeFile(summaryPath, "# Completed\nDo not mutate this history.\n");
      const before = await readFile(summaryPath, "utf8");
      const graph: MaterializedGraph = {
        nodes: [
          { id: "EVD-044", type: "EVD", provenance_type: "MEASURED", statement: "Measured failure." },
          { id: "ASM-007", type: "ASM", provenance_type: "ASSUMED", statement: "Latency stays bounded." },
          { id: "CAN-002", type: "CAN", provenance_type: "PROPOSED", statement: "Candidate mechanism." },
        ],
        edges: [
          { source: "EVD-044", target: "ASM-007", type: "falsifies" },
          { source: "CAN-002", target: "ASM-007", type: "depends_on" },
        ],
      };

      const result = propagateInvalidation(graph, "ASM-007", "EVD-044");
      expect(result.graph.nodes).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "CAN-002", status: "INVALIDATED" })]),
      );
      const notice = await emitGsdOperationalNotice(root, {
        falsifiedId: "ASM-007",
        evidenceId: "EVD-044",
        affectedIds: ["CAN-002"],
        reason: "Measured evidence falsified the assumption.",
      });
      expect(notice.affected_ids).toEqual(["CAN-002"]);
      expect(await readFile(summaryPath, "utf8")).toBe(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("F: initializes standalone Mode D and recovers state across fresh processes", async () => {
    const root = await temporaryRoot();
    try {
      const output: string[] = [];
      const stdout = new PassThrough();
      stdout.on("data", (chunk: Buffer) => output.push(chunk.toString()));
      const io = {
        cwd: root,
        stdout,
        stderr: new PassThrough(),
      };
      await runInit([], io);
      invokeCli(
        root,
        "node",
        "add",
        "TASK",
        "TASK-001",
        "--title",
        "Recover me",
        "--payload",
        JSON.stringify({ provenance_type: "FACT" }),
      );
      const status = JSON.parse(invokeCli(root, "status", "--json")) as {
        graph_health: { healthy: boolean; nodes: number };
      };

      expect(output.join("")).toContain('"mode":"standalone"');
      expect(status.graph_health).toMatchObject({ healthy: true, nodes: 1 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("G: uses the native provider when GSD is active and Matt is absent", async () => {
    const root = await temporaryRoot();
    try {
      await gsdFiles(root);
      const controller = new AriadneHarnessController({ rootDirectory: root, mattAvailable: false });

      expect(controller.mode).toBe("B");
      expect(controller.providerFor("matt")).toMatchObject({ kind: "native", available: true });
      await expect(controller.projectGsd()).resolves.toMatchObject({ decisions: expect.any(Array) });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("H: keeps GSD-owned documents canonical and writes only the overlay state", async () => {
    const root = await temporaryRoot();
    try {
      await gsdFiles(root);
      await writeFile(join(root, ".planning", "STATE.md"), "GSD state\n");
      await runInit(["--mode", "gsd"], {
        cwd: root,
        stdout: new PassThrough(),
        stderr: new PassThrough(),
      });
      const controller = new AriadneHarnessController({ rootDirectory: root, mattAvailable: false });
      await controller.persistNode({
        id: "TASK-001",
        type: "TASK",
        provenance_type: "FACT",
        statement: "Reference GSD state without shadowing it.",
      });

      expect(await readFile(join(root, ".planning", "STATE.md"), "utf8")).toBe("GSD state\n");
      expect(existsSync(join(root, ".planning", "ariadne", "STATE.yaml"))).toBe(true);
      expect(existsSync(join(root, ".planning", "ariadne", "PROJECT.md"))).toBe(false);
      expect(existsSync(join(root, ".ariadne"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("I: routes high change radius to dependencies analysis with DSM and Parnas", async () => {
    const skill = await readFile(join(repoRoot, ".agents", "skills", "ariadne", "SKILL.md"), "utf8");
    const dependencies = await readFile(
      join(repoRoot, ".agents", "skills", "ariadne", "rules", "60-dependencies.md"),
      "utf8",
    );

    expect(skill).toContain("rules/60-dependencies.md");
    expect(dependencies).toMatch(/DSM/i);
    expect(dependencies).toMatch(/Parnas/i);
    expect(dependencies).toMatch(/change radius/i);
  });

  it("J: migrates standalone state idempotently without shadowing GSD documents", async () => {
    const root = await temporaryRoot();
    try {
      await writeFile(join(root, "PROJECT.md"), "# Standalone project\n");
      await writeFile(join(root, "REQUIREMENTS.md"), "# Standalone requirements\n");
      await writeFile(join(root, "CONTEXT.md"), "# Standalone context\n");
      await mkdir(join(root, ".ariadne"), { recursive: true });
      await writeFile(join(root, ".ariadne", "STATE.yaml"), '{"frontier":["TASK-001"]}\n');
      await writeFile(
        join(root, ".ariadne", "GRAPH.jsonl"),
        '{"kind":"node","node":{"id":"TASK-001","type":"TASK","provenance_type":"FACT","statement":"Standalone"}}\n',
      );
      await writeFile(
        join(root, ".ariadne", "NOTICES.jsonl"),
        '{"id":"NOT-001","message":"standalone"}\n',
      );
      await mkdir(join(root, ".planning", "ariadne"), { recursive: true });
      await writeFile(join(root, ".planning", "PROJECT.md"), "# Existing GSD project\n");
      await writeFile(join(root, ".planning", "ROADMAP.md"), "# Existing roadmap\n");
      await writeFile(join(root, ".planning", "ariadne", "STATE.yaml"), '{"mode":"gsd"}\n');
      await writeFile(
        join(root, ".planning", "ariadne", "GRAPH.jsonl"),
        '{"kind":"node","node":{"id":"TASK-002","type":"TASK","provenance_type":"FACT","statement":"GSD"}}\n',
      );
      await writeFile(
        join(root, ".planning", "ariadne", "NOTICES.jsonl"),
        '{"id":"NOT-002","message":"gsd"}\n',
      );

      await migrateStandaloneToGsd(root);
      const first = {
        project: await readFile(join(root, ".planning", "PROJECT.md"), "utf8"),
        requirements: await readFile(join(root, ".planning", "REQUIREMENTS.md"), "utf8"),
        context: await readFile(join(root, ".planning", "CONTEXT.md"), "utf8"),
        state: await readFile(join(root, ".planning", "ariadne", "STATE.yaml"), "utf8"),
        graph: await readFile(join(root, ".planning", "ariadne", "GRAPH.jsonl"), "utf8"),
        notices: await readFile(join(root, ".planning", "ariadne", "NOTICES.jsonl"), "utf8"),
      };
      await migrateStandaloneToGsd(root);
      const second = {
        project: await readFile(join(root, ".planning", "PROJECT.md"), "utf8"),
        requirements: await readFile(join(root, ".planning", "REQUIREMENTS.md"), "utf8"),
        context: await readFile(join(root, ".planning", "CONTEXT.md"), "utf8"),
        state: await readFile(join(root, ".planning", "ariadne", "STATE.yaml"), "utf8"),
        graph: await readFile(join(root, ".planning", "ariadne", "GRAPH.jsonl"), "utf8"),
        notices: await readFile(join(root, ".planning", "ariadne", "NOTICES.jsonl"), "utf8"),
      };

      expect(first).toEqual(second);
      expect(first.project).toBe("# Existing GSD project\n");
      expect(first.requirements).toBe("# Standalone requirements\n");
      expect(first.context).toBe("# Standalone context\n");
      expect(first.state).toContain('"frontier"');
      expect(first.state).toContain('"mode"');
      expect(first.graph.match(/TASK-001/g)).toHaveLength(1);
      expect(first.graph.match(/TASK-002/g)).toHaveLength(1);
      expect(first.notices.match(/NOT-001/g)).toHaveLength(1);
      expect(first.notices.match(/NOT-002/g)).toHaveLength(1);
      expect(existsSync(join(root, ".planning", "ariadne", "PROJECT.md"))).toBe(false);
      expect(await readFile(join(root, "PROJECT.md"), "utf8")).toBe("# Standalone project\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
