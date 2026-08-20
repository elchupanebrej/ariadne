import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { NodeSchema, type Node } from "../../core/schemas/nodes.js";
import {
  detectGsd,
  type GsdDetectionOptions,
  type GsdEnvironment,
} from "./detector.js";

export type GsdDocuments = {
  project: string;
  requirements: string;
  roadmap: string;
  phaseContext: string;
  phaseContextPath?: string;
};

export type GsdProjection = {
  documents: GsdDocuments;
  nodes: Node[];
  decisions: Node[];
  environment: GsdEnvironment;
};

export type DecisionReopenOptions = {
  humanInstruction?: boolean | string;
  explicitHumanInstruction?: boolean | string;
  human_instruction?: boolean | string;
  falsifyingEvidence?: unknown;
  invalidatingEvidence?: unknown;
  falsifying_evidence?: unknown;
};

export type ProjectGsdOptions = GsdDetectionOptions & DecisionReopenOptions & {
  phase?: string;
  phaseContextPath?: string;
  reopen?: string | { decisionId?: string; id?: string } & DecisionReopenOptions;
  reopenDecision?: string | { decisionId?: string; id?: string } & DecisionReopenOptions;
  reopenDecisions?: Array<
    { decisionId?: string; id?: string } & DecisionReopenOptions
  >;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readRequired = async (path: string, label: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing GSD ${label}: ${path}`);
    }
    throw error;
  }
};

const readOptional = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
};

const phaseContextCandidates = async (environment: GsdEnvironment): Promise<string[]> => {
  const phasesPath = join(environment.planningPath, "phases");
  try {
    const entries = await readdir(phasesPath, { withFileTypes: true });
    return [join(environment.planningPath, "CONTEXT.md"), ...entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(phasesPath, entry.name, "CONTEXT.md"))
      .sort((left, right) => left.localeCompare(right))]
      .filter((path) => existsSync(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const contextPath = join(environment.planningPath, "CONTEXT.md");
      return existsSync(contextPath) ? [contextPath] : [];
    }
    throw error;
  }
};

const choosePhaseContext = async (
  environment: GsdEnvironment,
  options: ProjectGsdOptions,
): Promise<string | undefined> => {
  if (options.phaseContextPath) {
    return isAbsolute(options.phaseContextPath)
      ? options.phaseContextPath
      : join(environment.rootPath, options.phaseContextPath);
  }

  const candidates = await phaseContextCandidates(environment);
  if (options.phase) {
    const wanted = options.phase.toLowerCase();
    return candidates.find((candidate) => candidate.toLowerCase().includes(wanted));
  }
  return candidates[0];
};

const section = (markdown: string, name: string): string => {
  const lines = markdown.split(/\r?\n/u);
  const heading = new RegExp(`^(#{1,6})\\s+(?:locked\\s+)?${name}\\b`, "iu");
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return "";

  const level = /^#+/u.exec(lines[start])?.[0].length ?? 1;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const nextHeading = /^(#+)\s+/u.exec(line);
    if (nextHeading && nextHeading[1].length <= level) break;
    body.push(line);
  }
  return body.join("\n");
};

const decisionIdPattern = /\bD-[0-9A-Za-z][0-9A-Za-z_-]*\b/gu;

const cleanDecisionText = (line: string, id: string): string => {
  const withoutMarkdown = line
    .replace(/^\s*(?:[-*+]\s+|#{1,6}\s+)/u, "")
    .trim();
  const afterId = withoutMarkdown.slice(withoutMarkdown.indexOf(id) + id.length);
  return afterId.replace(/^\s*(?::|[-–—])?\s*/u, "").trim();
};

const decisionStatements = (markdown: string): Array<{ id: string; statement: string }> => {
  const lines = section(markdown, "Decisions").split(/\r?\n/u);
  const found: Array<{ id: string; statement: string }> = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const matches = [...line.matchAll(decisionIdPattern)];
    for (const match of matches) {
      const id = match[0];
      if (seen.has(id)) continue;
      seen.add(id);

      let statement = cleanDecisionText(line, id);
      if (!statement) {
        for (const following of lines.slice(index + 1)) {
          const candidate = following.trim();
          if (!candidate || /\bD-[0-9A-Za-z][0-9A-Za-z_-]*\b/u.test(candidate)) break;
          if (/^#{1,6}\s+/u.test(candidate)) break;
          statement = candidate.replace(/^[-*+]\s+/u, "").trim();
          if (statement) break;
        }
      }
      found.push({
        id,
        statement: statement || `Locked GSD decision ${id}`,
      });
    }
  }
  return found;
};

const compactDocument = (content: string): string => content.trim() || "GSD document is empty";

const documentNode = (
  id: string,
  type: "FRAME" | "TASK" | "STATE",
  statement: string,
  externalRef: string,
): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type: "DECIDED",
    statement: compactDocument(statement),
    external_ref: externalRef,
  });

const decisionNode = (
  id: string,
  statement: string,
  sourcePath: string | undefined,
): Node =>
  NodeSchema.parse({
    id: `DEC-${id}`,
    type: "DEC",
    provenance_type: "DECIDED",
    statement,
    status: "LOCKED",
    external_ref: `gsd:${id}`,
    ...(sourcePath ? { source_path: sourcePath } : {}),
  });

const hasAuthorization = (options: DecisionReopenOptions): boolean => {
  const human =
    options.humanInstruction ??
    options.explicitHumanInstruction ??
    options.human_instruction;
  if (human === true || (typeof human === "string" && human.trim() !== "")) return true;

  const evidence =
    options.falsifyingEvidence ??
    options.invalidatingEvidence ??
    options.falsifying_evidence;
  if (typeof evidence === "string") return evidence.trim() !== "";
  if (Array.isArray(evidence)) return evidence.length > 0;
  if (isRecord(evidence)) {
    return (
      evidence.falsifies === true ||
      evidence.invalidates === true ||
      evidence.invalidating === true ||
      evidence.relation === "falsifies" ||
      evidence.type === "falsifies"
    );
  }
  return evidence === true;
};

export function canReopenDecision(options: DecisionReopenOptions = {}): boolean {
  return hasAuthorization(options);
}

export function assertDecisionReopenAllowed(
  decision: string | Node,
  options: DecisionReopenOptions = {},
): void {
  const id = typeof decision === "string" ? decision : decision.id;
  if (!hasAuthorization(options)) {
    throw new Error(
      `Locked decision ${id} cannot be reopened without explicit human instruction or falsifying evidence`,
    );
  }
}

const reopenRequest = (
  request: ProjectGsdOptions["reopen"] | undefined,
): { id: string; options: DecisionReopenOptions } | undefined => {
  if (!request) return undefined;
  if (typeof request === "string") return { id: request, options: {} };
  const id = request.decisionId ?? request.id;
  return id ? { id, options: request } : undefined;
};

const validateReopenRequests = (options: ProjectGsdOptions): void => {
  const globalAuthorization: DecisionReopenOptions = {
    humanInstruction: options.humanInstruction,
    explicitHumanInstruction: options.explicitHumanInstruction,
    human_instruction: options.human_instruction,
    falsifyingEvidence: options.falsifyingEvidence,
    invalidatingEvidence: options.invalidatingEvidence,
    falsifying_evidence: options.falsifying_evidence,
  };
  const requests = [
    reopenRequest(options.reopen),
    reopenRequest(options.reopenDecision),
    ...(options.reopenDecisions ?? []).map((request) => reopenRequest(request)),
  ].filter((request): request is { id: string; options: DecisionReopenOptions } => request !== undefined);
  for (const request of requests) {
    assertDecisionReopenAllowed(request.id, { ...globalAuthorization, ...request.options });
  }
};

export async function projectGsd(
  rootDirectory = process.cwd(),
  options: ProjectGsdOptions = {},
): Promise<GsdProjection> {
  const environment = detectGsd(rootDirectory, options);
  if (!environment.active) {
    throw new Error("GSD is not active; projectGsd requires a .planning directory or override");
  }
  validateReopenRequests(options);

  const phaseContextPath = await choosePhaseContext(environment, options);
  const [project, requirements, roadmap, phaseContext] = await Promise.all([
    readRequired(join(environment.planningPath, "PROJECT.md"), "PROJECT.md"),
    readRequired(join(environment.planningPath, "REQUIREMENTS.md"), "REQUIREMENTS.md"),
    readRequired(join(environment.planningPath, "ROADMAP.md"), "ROADMAP.md"),
    phaseContextPath ? readOptional(phaseContextPath) : Promise.resolve(""),
  ]);

  const documents: GsdDocuments = {
    project,
    requirements,
    roadmap,
    phaseContext,
    ...(phaseContextPath ? { phaseContextPath } : {}),
  };
  const sourceNodes = [
    documentNode("FRAME-GSD-PROJECT", "FRAME", project, "gsd:PROJECT"),
    documentNode("TASK-GSD-REQUIREMENTS", "TASK", requirements, "gsd:REQUIREMENTS"),
    documentNode("STATE-GSD-ROADMAP", "STATE", roadmap, "gsd:ROADMAP"),
    ...(phaseContext
      ? [documentNode("FRAME-GSD-PHASE-CONTEXT", "FRAME", phaseContext, "gsd:CONTEXT")]
      : []),
  ];
  const decisions = decisionStatements(phaseContext).map((decision) =>
    decisionNode(decision.id, decision.statement, phaseContextPath),
  );

  return {
    documents,
    nodes: [...sourceNodes, ...decisions],
    decisions,
    environment,
  };
}

export const projectGsdWorkspace = projectGsd;
export const projectGsdArtifacts = projectGsd;
export const projectGsdContext = projectGsd;
