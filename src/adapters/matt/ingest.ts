import { createHash } from "node:crypto";
import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import { NodeSchema, type Node } from "../../core/schemas/nodes.js";
import type { ProvenanceType } from "../../core/types/nodes.js";

export const MATT_SKILLS = [
  "diagnosing-bugs",
  "research",
  "prototype",
  "tdd",
  "domain-modeling",
  "codebase-design",
  "code-review",
] as const;

export type MattSkill = (typeof MATT_SKILLS)[number];
export type MattArtifact = Record<string, unknown>;

const PROVENANCE_TYPES = new Set<ProvenanceType>([
  "UNKNOWN",
  "ASSUMED",
  "PROPOSED",
  "DERIVED",
  "MEASURED",
  "FACT",
  "DECIDED",
]);

const isRecord = (value: unknown): value is MattArtifact =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === "string" && value.trim() !== "");

const booleanValue = (...values: unknown[]): boolean | undefined =>
  values.find((value): value is boolean => typeof value === "boolean");

const hasValue = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== "";

const isMattSkill = (skill: string): skill is MattSkill =>
  (MATT_SKILLS as readonly string[]).includes(skill);

const canonicalType = (value: unknown): "EVD" | "EVDREQ" | undefined => {
  if (value === "EVD" || value === "EVDREQ") return value;
  if (value === "evidence") return "EVD";
  if (value === "evidence-request" || value === "request") return "EVDREQ";
  return undefined;
};

const explicitProvenance = (artifact: MattArtifact): ProvenanceType | undefined => {
  const value = stringValue(
    artifact.provenance_type,
    artifact.provenanceType,
    artifact.provenance,
  );
  if (!value || !PROVENANCE_TYPES.has(value as ProvenanceType)) return undefined;
  return value as ProvenanceType;
};

const hasExecutedResult = (artifact: MattArtifact): boolean => {
  if (
    booleanValue(artifact.executed, artifact.test_executed, artifact.testExecuted) === true
  ) {
    return true;
  }
  if (
    [
      artifact.result,
      artifact.verdict,
      artifact.exit_code,
      artifact.exitCode,
      artifact.passed,
      artifact.failed,
      artifact.stdout,
      artifact.stderr,
      artifact.output,
    ].some(hasValue)
  ) {
    return true;
  }
  return ["passed", "failed", "falsified", "verified", "error"].includes(
    stringValue(artifact.status)?.toLowerCase() ?? "",
  );
};

const explicitVerdict = (artifact: MattArtifact): string | undefined =>
  stringValue(artifact.verdict, artifact.verdict_type, artifact.verdictType);

const canonicalVerdict = (value: string | undefined): "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE" | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (/^(?:pass|passed|success|succeeded|supported|verified|true)$/u.test(normalized)) return "SUPPORTED";
  if (/^(?:fail|failed|failure|falsified|false|error|errored)$/u.test(normalized)) return "FALSIFIED";
  if (/^(?:inconclusive|unknown|skipped|skip)$/u.test(normalized)) return "INCONCLUSIVE";
  return undefined;
};

const evidenceMethod = (artifact: MattArtifact): string | undefined =>
  stringValue(
    artifact.method,
    artifact.test_method,
    artifact.testMethod,
    artifact.verification_method,
    artifact.verificationMethod,
    artifact.evidence_method,
  );

const evidentiaryRung = (artifact: MattArtifact): number | undefined => {
  const raw = artifact.rung ?? artifact.evidentiary_rung ?? artifact.evidentiaryRung;
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(/\b(?:rung\s*)?(10|[1-9])\b/iu.exec(raw)?.[1])
        : NaN;
  return value && Number.isInteger(value) && value >= 1 && value <= 10 ? value : undefined;
};

const commandOrSource = (artifact: MattArtifact): string | undefined =>
  stringValue(
    artifact.test_command,
    artifact.testCommand,
    artifact.command,
    artifact.source,
    artifact.source_ref,
    artifact.sourceRef,
    artifact.source_url,
    artifact.sourceUrl,
  );

const resultReceipt = (artifact: MattArtifact): unknown =>
  artifact.stdout_digest ??
  artifact.stdoutDigest ??
  artifact.result_digest ??
  artifact.resultDigest ??
  artifact.digest ??
  artifact.receipt ??
  artifact.result_receipt ??
  artifact.resultReceipt;

const hasReceipt = (value: unknown): boolean =>
  typeof value === "string"
    ? value.trim().length > 0
    : isRecord(value)
      ? Object.keys(value).length > 0
      : hasValue(value);

const reproducibleEnvironment = (artifact: MattArtifact): string | undefined =>
  stringValue(
    artifact.reproducible_environment,
    artifact.reproducibleEnvironment,
    artifact.environment,
    artifact.env,
  );

const completeExecutedEvidence = (artifact: MattArtifact): boolean =>
  hasExecutedResult(artifact) &&
  canonicalVerdict(explicitVerdict(artifact)) !== undefined &&
  evidenceMethod(artifact) !== undefined &&
  evidentiaryRung(artifact) !== undefined &&
  commandOrSource(artifact) !== undefined &&
  hasReceipt(resultReceipt(artifact)) &&
  reproducibleEnvironment(artifact) !== undefined;

const statementFor = (artifact: MattArtifact): string | undefined => {
  const direct = stringValue(
    artifact.statement,
    artifact.summary,
    artifact.description,
    artifact.title,
  );
  if (direct) return direct.trim();

  const result = artifact.result ?? artifact.output;
  if (typeof result === "string" && result.trim() !== "") return result.trim();
  if (result !== undefined && result !== null && typeof result !== "object") {
    return String(result);
  }
  return undefined;
};

const generatedId = (
  type: "EVD" | "EVDREQ",
  skill: MattSkill,
  statement: string,
  artifact: MattArtifact,
): string => {
  const material = JSON.stringify({
    skill,
    type,
    statement,
    result: artifact.result,
    verdict: artifact.verdict,
    test_command: artifact.test_command ?? artifact.command,
    stdout_digest: artifact.stdout_digest,
    method: artifact.method ?? artifact.verification_method,
    rung: artifact.rung ?? artifact.evidentiary_rung,
    environment: artifact.reproducible_environment ?? artifact.environment,
    receipt: artifact.receipt ?? artifact.result_receipt,
  });
  const digest = createHash("sha256").update(material).digest("hex").slice(0, 12);
  return `${type}-${digest}`;
};

export function normalizeMattArtifact(skillName: string, input: unknown): Node {
  const skill = skillName.trim();
  if (!isMattSkill(skill)) {
    throw new Error(`Unsupported Matt skill: ${skillName}`);
  }

  const artifact: MattArtifact =
    typeof input === "string"
      ? { statement: input }
      : isRecord(input)
        ? { ...input }
        : (() => {
            throw new Error("Matt artifact must be a JSON object or plain text");
          })();

  const statement = statementFor(artifact);
  if (!statement) throw new Error("Matt artifact requires a non-empty statement");

  const provenance = explicitProvenance(artifact);
  const requestedType = canonicalType(
    artifact.node_type ?? artifact.nodeType ?? artifact.kind ?? artifact.type,
  );
  const requestedEvidence =
    requestedType === "EVD" ||
    provenance === "MEASURED" ||
    booleanValue(artifact.red_capable, artifact.redCapable, artifact.redCapableTest) === true;
  const completeEvidence = completeExecutedEvidence(artifact);
  if (requestedEvidence && !completeEvidence && stringValue(artifact.id, artifact.node_id, artifact.nodeId)?.startsWith("EVD-")) {
    throw new Error(
      "Executed EVD requires an explicit verdict, method, evidentiary rung, command/source, result receipt or digest, and reproducible environment",
    );
  }
  const type = completeEvidence && requestedEvidence ? "EVD" : requestedType === "EVDREQ" || !requestedEvidence ? "EVDREQ" : "EVDREQ";
  const id =
    stringValue(artifact.id, artifact.node_id, artifact.nodeId) ??
    generatedId(type, skill, statement, artifact);

  if (!new RegExp(`^${type}-[0-9A-Za-z_-]+$`).test(id)) {
    throw new Error(`Matt artifact id must use the ${type}- prefix: ${id}`);
  }

  const node: MattArtifact = {
    ...artifact,
    id,
    type,
    provenance_type: type === "EVD" ? "MEASURED" : "PROPOSED",
    statement,
    skill,
  };
  if (type === "EVD") {
    node.verdict = canonicalVerdict(explicitVerdict(artifact));
    node.method = evidenceMethod(artifact);
    node.rung = evidentiaryRung(artifact);
    node.receipt = resultReceipt(artifact);
    node.environment = reproducibleEnvironment(artifact);
  }
  delete node.node_id;
  delete node.node_type;
  delete node.nodeType;
  delete node.provenanceType;
  delete node.provenance;

  return NodeSchema.parse(node);
}

export async function readMattArtifact(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, "utf8");
  if (extname(filePath).toLowerCase() === ".json") {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON in Matt artifact: ${filePath}`);
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function ingestMattFile(
  skillName: string,
  filePath: string,
): Promise<Node> {
  return normalizeMattArtifact(skillName, await readMattArtifact(filePath));
}
