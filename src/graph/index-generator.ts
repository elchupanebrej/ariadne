import {
  renderIndex,
  type MaterializedGraph,
} from "./storage.js";

export { renderIndex } from "./storage.js";
export type { MaterializedGraph } from "./storage.js";

export function generateIndex(graph: MaterializedGraph): string {
  return renderIndex(graph);
}
