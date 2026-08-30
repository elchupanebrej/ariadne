import type { EpistemicEdge } from "../core/schemas/edges.js";
import type { Node } from "../core/schemas/nodes.js";
import type { GraphEvent } from "./storage.js";

export type FoldedGraph = {
  nodes: Map<string, Node>;
  edges: EpistemicEdge[];
  childrenOf: Map<string, EpistemicEdge[]>;
};

// Append-only fold: latest append per node id wins; edges dedup on the triple.
export const fold = (events: readonly GraphEvent[]): FoldedGraph => {
  const nodes = new Map<string, Node>();
  const edgeKeys = new Set<string>();
  const edges: EpistemicEdge[] = [];
  for (const event of events) {
    if (event.kind === "node") {
      nodes.set(event.node.id, event.node);
    } else {
      const key = `${event.edge.source}\u0000${event.edge.type}\u0000${event.edge.target}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push(event.edge);
      }
    }
  }
  // Live-graph orientation: every edge reads "source depends on / derives from
  // / is answered by target", so source is downstream of target. Children(X) =
  // sources of edges targeting X. A root is a node that never appears as a
  // source.
  const childrenOf = new Map<string, EpistemicEdge[]>();
  for (const edge of edges) {
    const group = childrenOf.get(edge.target);
    if (group) group.push(edge);
    else childrenOf.set(edge.target, [edge]);
  }
  return { nodes, edges, childrenOf };
};

export const childEdges = (graph: FoldedGraph, id: string): EpistemicEdge[] =>
  (graph.childrenOf.get(id) ?? []).slice().sort((left, right) => left.source.localeCompare(right.source));

const reachableSet = (graph: FoldedGraph, rootId: string): Set<string> => {
  const probe = new Set([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    for (const edge of childEdges(graph, id)) {
      if (!probe.has(edge.source)) {
        probe.add(edge.source);
        stack.push(edge.source);
      }
    }
  }
  return probe;
};

export const reachableCount = (graph: FoldedGraph, rootId: string): number =>
  reachableSet(graph, rootId).size;

export type ForestSections = {
  sections: { root: string; reachable: number }[];
  remainderRoots: string[];
  remainderNodes: Set<string>;
};

// DEC-RPT-08 forest default: one full subtree per FRAME root that never
// appears as a source. Nodes whose ancestry does not lead back to a
// FRAME-rooted tree become the remainder.
export const computeForest = (graph: FoldedGraph): ForestSections => {
  const sources = new Set(graph.edges.map((edge) => edge.source));
  const frameRoots = [...graph.nodes.values()]
    .filter((node) => node.type === "FRAME" && !sources.has(node.id))
    .map((node) => node.id)
    .sort();
  const covered = new Set<string>();
  const sections: { root: string; reachable: number }[] = [];
  for (const root of frameRoots) {
    for (const id of reachableSet(graph, root)) covered.add(id);
    sections.push({ root, reachable: reachableSet(graph, root).size });
  }
  const remainderNodes = new Set([...graph.nodes.keys()].filter((id) => !covered.has(id)));
  const internalSources = new Set(
    graph.edges
      .filter((edge) => remainderNodes.has(edge.source) && remainderNodes.has(edge.target))
      .map((edge) => edge.source),
  );
  const remainderRoots = [...remainderNodes].filter((id) => !internalSources.has(id)).sort();
  return { sections, remainderRoots, remainderNodes };
};