import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { GraphStorage, type GraphEvent } from "../../src/graph/storage.js";

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

const node = (id: string, fields: Record<string, unknown>): GraphEvent => ({
  kind: "node",
  node: {
    provenance_type: "PROPOSED",
    statement: `Statement of ${id}.`,
    ...fields,
    id,
    type: id.split("-")[0],
  } as never,
});

const edge = (source: string, type: string, target: string): GraphEvent => ({
  kind: "edge",
  edge: { source, target, type } as never,
});

const seedWorkspace = async (events: GraphEvent[]) => {
  const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-continuation-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  for (const event of events) {
    if (event.kind === "node") await storage.appendNode(event.node);
    else await storage.appendEdge(event.edge);
  }
  return cwd;
};

const runStatusJson = async (cwd: string, args: readonly string[]) => {
  const stdout = capture();
  const stderr = capture();
  const code = await runCli(["status", ...args], {
    cwd,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  const output = stdout.text();
  return { code, stderr: stderr.text(), json: output ? JSON.parse(output) : undefined };
};

const readySeed: GraphEvent[] = [
  node("FRAME-cont-ready", { provenance_type: "FACT", title: "Ready frame" }),
  node("CAN-cont-a", { title: "Candidate mechanism" }),
  node("EVD-cont-a", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
    rung: 3,
  }),
  edge("CAN-cont-a", "derived_from", "FRAME-cont-ready"),
  edge("EVD-cont-a", "supports", "CAN-cont-a"),
];

const insufficientSeed: GraphEvent[] = [
  node("FRAME-cont-insuff", { provenance_type: "FACT", title: "Insufficient frame" }),
  node("UNK-cont-b", { provenance_type: "UNKNOWN", title: "Open unknown" }),
  node("ASM-cont-a", { provenance_type: "ASSUMED", title: "Unverified assumption" }),
  edge("UNK-cont-b", "references", "FRAME-cont-insuff"),
  edge("ASM-cont-a", "derived_from", "FRAME-cont-insuff"),
];

const prioritySeed: GraphEvent[] = [
  node("FRAME-cont-prio", { provenance_type: "FACT", title: "Priority frame" }),
  node("CAN-cont-p", { title: "Supported candidate" }),
  node("EVD-cont-p", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
  }),
  node("ASM-cont-x", { provenance_type: "ASSUMED", title: "Side assumption" }),
  edge("CAN-cont-p", "derived_from", "FRAME-cont-prio"),
  edge("EVD-cont-p", "supports", "CAN-cont-p"),
  edge("ASM-cont-x", "derived_from", "FRAME-cont-prio"),
];

const contradictedSeed: GraphEvent[] = [
  node("FRAME-cont-ctr", { provenance_type: "FACT", title: "Contradicted frame" }),
  node("CAN-cont-c", { title: "Contradicted candidate" }),
  node("EVD-cont-c", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
  }),
  node("CTR-cont-x", { title: "Active contradiction" }),
  edge("CAN-cont-c", "derived_from", "FRAME-cont-ctr"),
  edge("EVD-cont-c", "supports", "CAN-cont-c"),
  edge("CTR-cont-x", "contradicts", "CAN-cont-c"),
];

const coveredSeed: GraphEvent[] = [
  node("FRAME-cont-cov", { provenance_type: "FACT", title: "Covered frame" }),
  node("ASM-cont-cov", { provenance_type: "ASSUMED", title: "Covered assumption" }),
  node("EVDREQ-cont-cov", { title: "Open evidence request" }),
  edge("ASM-cont-cov", "derived_from", "FRAME-cont-cov"),
  edge("EVDREQ-cont-cov", "tests", "ASM-cont-cov"),
];

type Case = {
  name: string;
  seed: GraphEvent[];
  frame: string;
  readiness_class: string | null;
  operation?: string;
  actionContains?: string;
  unlocks?: string[];
};

const cases: Case[] = [
  {
    name: "decision-ready frame directs recording the decision",
    seed: readySeed,
    frame: "FRAME-cont-ready",
    readiness_class: "ready",
    operation: "record_decision",
    actionContains: "CAN-cont-a",
  },
  {
    name: "insufficient-information frame raises the unknown plus an evidence request",
    seed: insufficientSeed,
    frame: "FRAME-cont-insuff",
    readiness_class: "insufficient-information",
    operation: "raise_unknown_and_evidence_request",
    actionContains: "ASM-cont-a",
    unlocks: ["UNK-cont-b"],
  },
  {
    name: "ready outranks insufficient-information per the priority order",
    seed: prioritySeed,
    frame: "FRAME-cont-prio",
    readiness_class: "ready",
    operation: "record_decision",
    actionContains: "CAN-cont-p",
  },
  {
    name: "actively contradicted candidate yields no ready recommendation",
    seed: contradictedSeed,
    frame: "FRAME-cont-ctr",
    readiness_class: null,
  },
  {
    name: "assumption covered by an evidence request is not insufficient",
    seed: coveredSeed,
    frame: "FRAME-cont-cov",
    readiness_class: null,
  },
];

const expectContinuationShape = (continuation: Record<string, unknown>) => {
  expect(typeof continuation.next_action).toBe("string");
  expect(typeof continuation.operation).toBe("string");
  expect(typeof continuation.command_or_template).toBe("string");
  expect(Array.isArray(continuation.dependencies)).toBe(true);
  expect(Array.isArray(continuation.unlocks)).toBe(true);
};

describe("ariadne status FRAME-id continuation", () => {
  it.each(cases)("$name", async (c) => {
    const cwd = await seedWorkspace(c.seed);
    const { code, stderr, json } = await runStatusJson(cwd, [c.frame, "--json"]);
    const continuation = json.continuation as Record<string, unknown> | undefined;

    expect(code).toBe(0);
    expect(stderr).toBe("");
    if (c.readiness_class === null) {
      expect(continuation).toBeUndefined();
      return;
    }
    expect(continuation?.readiness_class).toBe(c.readiness_class);
    expect(continuation?.operation).toBe(c.operation);
    expect(continuation?.next_action).toContain(c.actionContains);
    expectContinuationShape(continuation!);
    if (c.unlocks) expect(continuation?.unlocks).toEqual(c.unlocks);
  });

  it("emits exactly one next action with the full field shape", async () => {
    const cwd = await seedWorkspace(readySeed);
    const { json } = await runStatusJson(cwd, ["FRAME-cont-ready", "--json"]);
    const continuation = json.continuation as Record<string, unknown>;

    expect(continuation.next_action).toBe("Record the decision for CAN-cont-a");
    expect(Object.keys(continuation).sort()).toEqual([
      "command_or_template",
      "dependencies",
      "next_action",
      "operation",
      "readiness_class",
      "unlocks",
    ]);
  });

  it("produces identical continuations across runs for the same graph and frame", async () => {
    const first = await runStatusJson(await seedWorkspace(readySeed), [
      "FRAME-cont-ready",
      "--json",
    ]);
    const second = await runStatusJson(await seedWorkspace(readySeed), [
      "FRAME-cont-ready",
      "--json",
    ]);

    expect(JSON.stringify(first.json.continuation)).toBe(
      JSON.stringify(second.json.continuation),
    );
  });

  it("adds no continuation block when no frame argument is supplied", async () => {
    const cwd = await seedWorkspace(readySeed);
    const { json } = await runStatusJson(cwd, ["--json"]);

    expect(json.continuation).toBeUndefined();
  });

  it("fails with exit 1 for an unknown frame id", async () => {
    const cwd = await seedWorkspace(readySeed);
    const { code, stderr, json } = await runStatusJson(cwd, ["FRAME-missing-1", "--json"]);

    expect(code).toBe(1);
    expect(stderr).toContain("Unknown FRAME");
    expect(json).toBeUndefined();
  });

  it("renders the continuation in the text status output", async () => {
    const cwd = await seedWorkspace(readySeed);
    const stdout = capture();
    const code = await runCli(["status", "FRAME-cont-ready"], {
      cwd,
      stdout: stdout.stream,
      stderr: capture().stream,
    });

    expect(code).toBe(0);
    expect(stdout.text()).toContain("Next action (ready): Record the decision for CAN-cont-a");
  });
});

describe("ariadne report FRAME-id --json continuation", () => {
  it("carries the continuation block in the report JSON", async () => {
    const cwd = await seedWorkspace(readySeed);
    const stdout = capture();
    const code = await runCli(["report", "FRAME-cont-ready", "--json"], {
      cwd,
      stdout: stdout.stream,
      stderr: capture().stream,
    });
    const parsed = JSON.parse(stdout.text()) as {
      file: string;
      continuation?: Record<string, unknown>;
    };

    expect(code).toBe(0);
    expect(parsed.file).toContain(".ariadne/reports/");
    expect(parsed.continuation?.readiness_class).toBe("ready");
    expect(parsed.continuation?.operation).toBe("record_decision");
    expectContinuationShape(parsed.continuation!);
  });

  it("adds no continuation block to the forest report without a frame argument", async () => {
    const cwd = await seedWorkspace(readySeed);
    const stdout = capture();
    const code = await runCli(["report", "--json"], {
      cwd,
      stdout: stdout.stream,
      stderr: capture().stream,
    });
    const parsed = JSON.parse(stdout.text()) as { continuation?: unknown };

    expect(code).toBe(0);
    expect(parsed.continuation).toBeUndefined();
  });
});
