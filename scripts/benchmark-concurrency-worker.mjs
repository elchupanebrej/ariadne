import { EpistemicGraph } from "../src/graph/epistemic-graph.js";
import { GraphStorage } from "../src/graph/storage.js";

const storageDir = process.argv[2];
const mode = process.argv[3];

if (!storageDir || (mode !== "reader" && mode !== "writer")) {
  process.exitCode = 2;
} else {
  try {
    if (mode === "writer") {
      await new GraphStorage(storageDir).regenerateIndex();
    } else {
      await EpistemicGraph.open(storageDir).materialize();
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
