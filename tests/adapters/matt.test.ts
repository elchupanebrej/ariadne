import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeMattArtifact } from "../../src/adapters/matt/ingest.js";
import { runMattIngest } from "../../src/cli/commands/ingest.js";
import { NodeSchema } from "../../src/core/schemas/nodes.js";

describe("Matt skill output ingestion", () => {
  it("does not promote an incomplete red-capable diagnosing-bugs result", () => {
    const node = normalizeMattArtifact("diagnosing-bugs", {
      id: "EVDREQ-007",
      statement: "The regression reproduces with the red-capable test.",
      red_capable: true,
      executed: true,
      test_command: "npm test -- regression",
      result: "failed",
    });

    expect(node).toMatchObject({ id: "EVDREQ-007", type: "EVDREQ", provenance_type: "PROPOSED" });
    expect(NodeSchema.safeParse(node).success).toBe(true);
  });

  it("does not promote a red-capable tdd result without a complete receipt", () => {
    const node = normalizeMattArtifact("tdd", {
      id: "EVDREQ-008",
      statement: "The new behavior passes the focused test.",
      red_capable: true,
      executed: true,
      test_command: "npm test -- focused",
      result: "passed",
    });

    expect(node).toMatchObject({ type: "EVDREQ", provenance_type: "PROPOSED" });
  });

  it("promotes only a fully receipted executed result", () => {
    const node = normalizeMattArtifact("tdd", {
      id: "EVD-009",
      statement: "The focused test supports the change.",
      red_capable: true,
      executed: true,
      verdict: "SUPPORTED",
      method: "vitest",
      rung: 3,
      test_command: "npm test -- focused",
      stdout_digest: "sha256:abc",
      reproducible_environment: "node-22/linux-x64",
    });

    expect(node).toMatchObject({ type: "EVD", provenance_type: "MEASURED", verdict: "SUPPORTED" });
  });

  it("keeps plain text as a proposed evidence request", () => {
    const node = normalizeMattArtifact("research", "Check the primary source first.");

    expect(node).toMatchObject({
      type: "EVDREQ",
      provenance_type: "PROPOSED",
      statement: "Check the primary source first.",
    });
    expect(NodeSchema.safeParse(node).success).toBe(true);
  });

  it("accepts a structured evidence request", () => {
    const node = normalizeMattArtifact("prototype", {
      id: "EVDREQ-009",
      type: "EVDREQ",
      statement: "Measure whether the prototype meets the latency bound.",
      falsification_conditions: ["p99 exceeds 50ms"],
    });

    expect(node).toMatchObject({
      id: "EVDREQ-009",
      type: "EVDREQ",
      provenance_type: "PROPOSED",
    });
  });

  it("runs the matt command helper against a file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-matt-"));
    try {
      const file = join(directory, "diagnosis.json");
      await writeFile(
        file,
        JSON.stringify({
          id: "EVDREQ-010",
          statement: "The command helper preserves structured output.",
          red_capable: true,
          executed: true,
          result: "passed",
        }),
      );

      await expect(
        runMattIngest(["matt", "diagnosing-bugs", file]),
      ).resolves.toMatchObject({
        id: "EVDREQ-010",
        type: "EVDREQ",
        provenance_type: "PROPOSED",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed JSON and unsupported human-only skills", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-matt-"));
    try {
      const file = join(directory, "broken.json");
      await writeFile(file, "{broken");

      await expect(
        runMattIngest(["matt", "research", file]),
      ).rejects.toThrow(/invalid JSON/i);
      expect(() => normalizeMattArtifact("to-spec", "do not run this")).toThrow(
        /unsupported Matt skill/i,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
