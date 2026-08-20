import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { EpistemicEdge } from "../../core/schemas/edges.js";
import type { Node } from "../../core/schemas/nodes.js";
import type { MaterializedGraph } from "../../graph/storage.js";
import { detectGsd } from "../gsd/detector.js";

export type HandoffRecommendation = "/to-spec" | "/to-tickets";

export type HandoffOptions = {
  rootDirectory?: string;
  root?: string;
  workspaceRoot?: string;
  outputPath?: string;
  changeRadius?: "bounded" | "high" | "architectural" | "large" | number | string;
  highChangeRadius?: boolean;
  architectural?: boolean;
};

export type HandoffArtifact = {
  artifactPath: string;
  content: string;
  recommendedCommand: HandoffRecommendation;
};

const INACTIVE_STATUSES = new Set([
  "INVALIDATED",
  "FALSIFIED",
  "INACTIVE",
  "CLOSED",
  "RETIRED",
  "NEEDS_REVIEW",
  "RE_OPENED",
  "STALE",
  "REQUIRES_REVALUATION",
  "BLOCKED",
]);

const isActive = (node: Node): boolean =>
  typeof node.status !== "string" ||
  !INACTIVE_STATUSES.has(node.status.toUpperCase().replaceAll("-", "_"));

const isInvariant = (node: Node): boolean =>
  node.invariant === true ||
  (typeof node.kind === "string" && node.kind.toLowerCase() === "invariant");

const compact = (value: string, limit = 220): string => {
  const oneLine = value.replace(/\s+/gu, " ").trim();
  return oneLine.length > limit ? `${oneLine.slice(0, limit - 1)}…` : oneLine;
};

const deductive = (edge: EpistemicEdge): boolean =>
  edge.type === "depends_on" || edge.type === "derived_from";

const basisFor = (decisionId: string, graph: MaterializedGraph): Node[] => {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesByNode = new Map<string, Array<{ id: string; relation: string }>>();
  const add = (id: string, neighbor: string, relation: string): void => {
    const values = edgesByNode.get(id) ?? [];
    values.push({ id: neighbor, relation });
    edgesByNode.set(id, values);
  };

  for (const edge of graph.edges.filter(deductive)) {
    // The primary direction is source -> target. The reverse link also keeps
    // handoffs useful for graphs written with the older DEC-as-target shape.
    add(edge.source, edge.target, edge.type);
    add(edge.target, edge.source, edge.type);
  }
  for (const values of edgesByNode.values()) {
    values.sort((left, right) =>
      `${left.id}\u0000${left.relation}`.localeCompare(`${right.id}\u0000${right.relation}`),
    );
  }

  const visited = new Set<string>([decisionId]);
  const queue = [decisionId];
  const basis: Node[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const neighbor of edgesByNode.get(current) ?? []) {
      if (visited.has(neighbor.id)) continue;
      visited.add(neighbor.id);
      const node = nodeById.get(neighbor.id);
      if (node) basis.push(node);
      queue.push(neighbor.id);
    }
  }
  return basis.sort((left, right) => left.id.localeCompare(right.id));
};

const adrReferences = (node: Node): string[] => {
  const references = new Set<string>();
  const addText = (value: string, adrField = false): void => {
    for (const match of value.matchAll(/\bADR(?:[-_ ]?)(\d{3,})\b/giu)) {
      references.add(`ADR-${match[1]}`);
    }
    if (adrField && /^\d{3,}$/u.test(value.trim())) references.add(`ADR-${value.trim()}`);
  };

  addText(node.statement);
  for (const key of [
    "adr",
    "adr_ref",
    "adr_refs",
    "adr_reference",
    "adr_references",
    "references",
  ]) {
    const value = node[key];
    if (typeof value === "string") addText(value, key.startsWith("adr"));
    if (Array.isArray(value)) {
      for (const item of value) if (typeof item === "string") addText(item, key.startsWith("adr"));
    }
  }
  return [...references].sort((left, right) => left.localeCompare(right));
};

const highRadius = (decision: Node, options: HandoffOptions): boolean => {
  if (options.highChangeRadius === true || options.architectural === true) return true;
  const radius = options.changeRadius ?? decision.change_radius ?? decision.changeRadius;
  if (typeof radius === "number") return radius >= 3;
  if (typeof radius === "string") {
    return ["high", "large", "architectural", "deep", "enterprise"].includes(
      radius.toLowerCase(),
    );
  }
  return decision.architectural === true || decision.architectural_decision === true;
};

const renderSection = (title: string, nodes: Node[]): string => {
  const rows = nodes.map((node) => `- ${node.id} [${node.provenance_type}] ${compact(node.statement)}`);
  return [`## ${title}`, "", ...(rows.length > 0 ? rows : ["- None"]), ""].join("\n");
};

export async function generateHandoff(
  decisionId: string,
  graph: MaterializedGraph,
  options: HandoffOptions = {},
): Promise<HandoffArtifact> {
  const decision = graph.nodes.find((node) => node.id === decisionId);
  if (!decision || decision.type !== "DEC") {
    throw new Error(`Handoff requires DEC decision node ${decisionId}`);
  }

  const rootDirectory = resolve(
    options.rootDirectory ?? options.root ?? options.workspaceRoot ?? process.cwd(),
  );
  const environment = detectGsd(rootDirectory);
  const defaultDirectory = environment.active ? environment.overlayPath : join(rootDirectory, ".ariadne");
  const artifactPath = options.outputPath
    ? isAbsolute(options.outputPath)
      ? options.outputPath
      : join(rootDirectory, options.outputPath)
    : join(defaultDirectory, "HANDOFF.md");

  if (!isActive(decision)) {
    throw new Error(`Cannot hand off decision ${decision.id}: decision is stale or reopened`);
  }

  const basis = basisFor(decisionId, graph);
  const blockedDependency = basis.find((node) => !isActive(node));
  if (blockedDependency) {
    throw new Error(
      `Cannot hand off decision ${decision.id}: blocking dependency ${blockedDependency.id} is stale or reopened`,
    );
  }
  const verifiedFacts = basis.filter(
    (node) => isActive(node) && ["FACT", "MEASURED", "DECIDED"].includes(node.provenance_type),
  );
  const activeInvariants = graph.nodes
    .filter((node) => isActive(node) && isInvariant(node))
    .sort((left, right) => left.id.localeCompare(right.id));
  const referenceNodes = [decision, ...basis, ...activeInvariants];
  const adrRefs = [...new Set(referenceNodes.flatMap(adrReferences))].sort((left, right) =>
    left.localeCompare(right),
  );
  const recommendedCommand: HandoffRecommendation = highRadius(decision, options)
    ? "/to-spec"
    : "/to-tickets";

  const content = [
    "# Ariadne Handoff",
    "",
    `Decision: ${decision.id}`,
    "",
    compact(decision.statement),
    "",
    renderSection("Verified facts", verifiedFacts),
    renderSection("Active invariants", activeInvariants),
    "## ADR references",
    "",
    ...(adrRefs.length > 0 ? adrRefs.map((reference) => `- ${reference}`) : ["- None"]),
    "",
    "## Recommended next step",
    "",
    `Run \`${recommendedCommand}\` as the next human-controlled step.`,
    "",
  ].join("\n");

  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, content, "utf8");
  return { artifactPath, content, recommendedCommand };
}
