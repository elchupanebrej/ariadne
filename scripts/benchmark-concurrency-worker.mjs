import { EpistemicGraph } from "../src/graph/epistemic-graph.js";

const storageDir = process.argv[2];
const mode = process.argv[3];

if (!storageDir || (mode !== "reader" && mode !== "writer")) {
  process.exitCode = 2;
} else {
  try {
    if (mode === "writer") {
      await EpistemicGraph.open(storageDir).regenerateIndex();
    } else {
      await EpistemicGraph.open(storageDir).materialize();
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
