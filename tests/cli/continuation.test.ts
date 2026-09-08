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

const mergeConflictSeed: GraphEvent[] = [
  node("FRAME-cont-mrg", { provenance_type: "FACT", title: "Merge conflict frame" }),
  node("CTR-cont-mrg", {
    title: "Merge conflict",
    status: "MERGE_CONFLICT",
    conflict_kind: "branch_merge",
    subject_key: "CAN-cont-mrg",
  }),
  node("CAN-cont-mrg", { title: "Shadowed candidate" }),
  edge("CTR-cont-mrg", "derived_from", "FRAME-cont-mrg"),
  edge("CAN-cont-mrg", "derived_from", "FRAME-cont-mrg"),
];

const underRungSeed: GraphEvent[] = [
  node("FRAME-cont-rung", { provenance_type: "FACT", title: "Under-rung frame" }),
  node("ASM-cont-rung", { provenance_type: "ASSUMED", title: "Claim under test" }),
  node("EVDREQ-cont-rung", { title: "Evidence request", required_rung: 5 }),
  node("EVD-cont-rung", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
    rung: 3,
  }),
  edge("ASM-cont-rung", "derived_from", "FRAME-cont-rung"),
  edge("EVDREQ-cont-rung", "tests", "ASM-cont-rung"),
  edge("EVD-cont-rung", "answers", "EVDREQ-cont-rung"),
];

const answeredSeed: GraphEvent[] = [
  node("FRAME-cont-ans", { provenance_type: "FACT", title: "Answered frame" }),
  node("CAN-cont-ans", { title: "Supported candidate" }),
  node("EVD-cont-ans", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
    rung: 3,
  }),
  node("EVDREQ-cont-ans", { title: "Answered request", required_rung: 3 }),
  edge("CAN-cont-ans", "derived_from", "FRAME-cont-ans"),
  edge("EVD-cont-ans", "supports", "CAN-cont-ans"),
  edge("EVD-cont-ans", "answers", "EVDREQ-cont-ans"),
];

const depEdgeSeed: GraphEvent[] = [
  node("FRAME-cont-dep", { provenance_type: "FACT", title: "Dependent frame" }),
  node("CAN-cont-dep-b", { title: "Dependent candidate" }),
  node("CAN-cont-dep-a", { title: "Unsatisfied dependency" }),
  edge("CAN-cont-dep-b", "derived_from", "FRAME-cont-dep"),
  edge("CAN-cont-dep-b", "depends_on", "CAN-cont-dep-a"),
];

const depArraySeed: GraphEvent[] = [
  node("FRAME-cont-dep2", { provenance_type: "FACT", title: "Dependent frame" }),
  node("CAN-cont-dep2-a", { title: "Unsatisfied dependency" }),
  node("CAN-cont-dep2-b", { title: "Dependent candidate", dependencies: ["CAN-cont-dep2-a"] }),
  edge("CAN-cont-dep2-b", "derived_from", "FRAME-cont-dep2"),
];

const blockedInvalidatedSeed: GraphEvent[] = [
  node("FRAME-cont-blk", { provenance_type: "FACT", title: "Blocked frame" }),
  node("CAN-cont-blk", { title: "Unsupported candidate" }),
  node("CAN-cont-blk-old", { title: "Invalidated candidate", status: "INVALIDATED" }),
  edge("CAN-cont-blk", "derived_from", "FRAME-cont-blk"),
  edge("CAN-cont-blk-old", "derived_from", "FRAME-cont-blk"),
];

const blockedReceiptSeed: GraphEvent[] = [
  node("FRAME-cont-trn", { provenance_type: "FACT", title: "Unreceipted transition frame" }),
  node("CAN-cont-trn", { title: "Transitioned candidate" }),
  node("TRANS-cont-trn", {
    title: "Transition without receipt",
    target_mechanism_ref: "CAN-cont-trn",
    retirement_predicate: "candidate retired by successor",
    expiration_deadline: "2027-01-01T00:00:00Z",
    cleanup_verification_test: "npm test",
    owner: "owner-a",
    lifecycle_state: "PROPOSED",
  }),
  edge("CAN-cont-trn", "derived_from", "FRAME-cont-trn"),
  edge("TRANS-cont-trn", "derived_from", "FRAME-cont-trn"),
];

const blockedContradictionSeed: GraphEvent[] = [
  node("FRAME-cont-dtr", { provenance_type: "FACT", title: "Dead-proposition contradiction frame" }),
  node("CAN-cont-dtr", { title: "Unsupported candidate" }),
  node("CAN-cont-dtr-old", { title: "Decided candidate", provenance_type: "DECIDED" }),
  node("CTR-cont-dtr", { title: "Contradiction on a dead proposition" }),
  edge("CAN-cont-dtr", "derived_from", "FRAME-cont-dtr"),
  edge("CAN-cont-dtr-old", "derived_from", "FRAME-cont-dtr"),
  edge("CTR-cont-dtr", "contradicts", "CAN-cont-dtr-old"),
];

const contradictionPrioritySeed: GraphEvent[] = [
  node("FRAME-cont-pri", { provenance_type: "FACT", title: "Contradiction and evidence frame" }),
  node("CAN-cont-pri", { title: "Contested candidate" }),
  node("EVDREQ-cont-pri", { title: "Outstanding evidence request" }),
  node("CTR-cont-pri", { title: "Active contradiction" }),
  edge("CAN-cont-pri", "derived_from", "FRAME-cont-pri"),
  edge("EVDREQ-cont-pri", "tests", "CAN-cont-pri"),
  edge("CTR-cont-pri", "contradicts", "CAN-cont-pri"),
];

const tieSeed: GraphEvent[] = [
  node("FRAME-cont-tie", { provenance_type: "FACT", title: "Tied frame" }),
  node("CAN-cont-tie-b", { title: "Second candidate" }),
  node("CAN-cont-tie-a", { title: "First candidate" }),
  node("EVD-cont-tie-b", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
  }),
  node("EVD-cont-tie-a", {
    provenance_type: "MEASURED",
    verdict: "SUPPORTED",
    status: "OBSERVED",
  }),
  edge("CAN-cont-tie-b", "derived_from", "FRAME-cont-tie"),
  edge("CAN-cont-tie-a", "derived_from", "FRAME-cont-tie"),
  edge("EVD-cont-tie-b", "supports", "CAN-cont-tie-b"),
  edge("EVD-cont-tie-a", "supports", "CAN-cont-tie-a"),
];

type Case = {
  name: string;
  seed: GraphEvent[];
  frame: string;
  readiness_class: string | null;
  operation?: string;
  actionContains?: string;
  unlocks?: string[];
  missingDeps?: string[];
  diagnosticCode?: string;
  diagnosticTarget?: string;
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
    name: "actively contradicted candidate fails closed to blocked-contradiction",
    seed: contradictedSeed,
    frame: "FRAME-cont-ctr",
    readiness_class: "blocked-contradiction",
    operation: "resolve_contradiction",
    actionContains: "CTR-cont-x",
  },
  {
    name: "merge-conflict status fails closed to blocked-contradiction",
    seed: mergeConflictSeed,
    frame: "FRAME-cont-mrg",
    readiness_class: "blocked-contradiction",
    operation: "resolve_contradiction",
    actionContains: "CTR-cont-mrg",
  },
  {
    name: "outstanding evidence request fails closed to blocked-evidence",
    seed: coveredSeed,
    frame: "FRAME-cont-cov",
    readiness_class: "blocked-evidence",
    operation: "execute_pinned_method_and_record_evidence",
    actionContains: "EVDREQ-cont-cov",
  },
  {
    name: "required rung above the answering evidence rung stays blocked-evidence",
    seed: underRungSeed,
    frame: "FRAME-cont-rung",
    readiness_class: "blocked-evidence",
    operation: "execute_pinned_method_and_record_evidence",
    actionContains: "EVDREQ-cont-rung",
  },
  {
    name: "evidence request answered at the required rung leaves the frame ready",
    seed: answeredSeed,
    frame: "FRAME-cont-ans",
    readiness_class: "ready",
    operation: "record_decision",
    actionContains: "CAN-cont-ans",
  },
  {
    name: "unmet depends_on dependency fails closed to blocked-dependency",
    seed: depEdgeSeed,
    frame: "FRAME-cont-dep",
    readiness_class: "blocked-dependency",
    operation: "resolve_dependency",
    actionContains: "CAN-cont-dep-a",
    missingDeps: ["CAN-cont-dep-a"],
  },
  {
    name: "unmet dependency ids fail closed to blocked-dependency",
    seed: depArraySeed,
    frame: "FRAME-cont-dep2",
    readiness_class: "blocked-dependency",
    operation: "resolve_dependency",
    actionContains: "CAN-cont-dep2-a",
    missingDeps: ["CAN-cont-dep2-a"],
  },
  {
    name: "contradiction outranks an outstanding evidence request",
    seed: contradictionPrioritySeed,
    frame: "FRAME-cont-pri",
    readiness_class: "blocked-contradiction",
    operation: "resolve_contradiction",
    actionContains: "CTR-cont-pri",
  },
  {
    name: "tied ready candidates break by node id with the runner-up in unlocks",
    seed: tieSeed,
    frame: "FRAME-cont-tie",
    readiness_class: "ready",
    operation: "record_decision",
    actionContains: "CAN-cont-tie-a",
    unlocks: ["CAN-cont-tie-b"],
  },
  {
    name: "fully blocked frame returns a structured diagnostic without a recommendation",
    seed: blockedInvalidatedSeed,
    frame: "FRAME-cont-blk",
    readiness_class: "blocked",
    diagnosticCode: "invalidated-path",
    diagnosticTarget: "CAN-cont-blk-old",
  },
  {
    name: "transition missing its owner receipt returns a blocked diagnostic",
    seed: blockedReceiptSeed,
    frame: "FRAME-cont-trn",
    readiness_class: "blocked",
    diagnosticCode: "missing-owner-receipt",
    diagnosticTarget: "TRANS-cont-trn",
  },
  {
    name: "contradiction on a dead proposition returns a blocked diagnostic",
    seed: blockedContradictionSeed,
    frame: "FRAME-cont-dtr",
    readiness_class: "blocked",
    diagnosticCode: "unresolved-contradiction",
    diagnosticTarget: "CTR-cont-dtr",
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
    if (c.readiness_class === "blocked") {
      expect(Object.keys(continuation!).sort()).toEqual(["diagnostic", "readiness_class"]);
      const diagnostic = continuation!.diagnostic as Record<string, unknown>;
      for (const field of ["severity", "code", "message", "target", "fix"]) {
        expect(typeof diagnostic[field]).toBe("string");
        expect(diagnostic[field]).not.toBe("");
      }
      if (c.diagnosticCode) expect(diagnostic.code).toBe(c.diagnosticCode);
      if (c.diagnosticTarget) expect(diagnostic.target).toBe(c.diagnosticTarget);
      return;
    }
    expect(continuation?.operation).toBe(c.operation);
    expect(continuation?.next_action).toContain(c.actionContains);
    expectContinuationShape(continuation!);
    if (c.unlocks) expect(continuation?.unlocks).toEqual(c.unlocks);
    if (c.missingDeps) {
      expect(continuation?.missingDeps).toEqual(c.missingDeps);
      expect(continuation?.dependencies).toEqual(c.missingDeps);
    }
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

    expect(code).toBe(2);
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

  it("renders the blocked diagnostic in the text status output", async () => {
    const cwd = await seedWorkspace(blockedInvalidatedSeed);
    const stdout = capture();
    const code = await runCli(["status", "FRAME-cont-blk"], {
      cwd,
      stdout: stdout.stream,
      stderr: capture().stream,
    });

    expect(code).toBe(0);
    expect(stdout.text()).toContain("Blocked (error) [invalidated-path]");
    expect(stdout.text()).toContain("Target: CAN-cont-blk-old");
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
