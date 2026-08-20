import { z } from "zod";
import { AriadneEpistemicEnvelope } from "./envelope.js";

export function exportEnvelopeJsonSchema() {
  return z.toJSONSchema(AriadneEpistemicEnvelope, {
    target: "draft-2020-12",
  });
}

export const toEnvelopeJsonSchema = exportEnvelopeJsonSchema;
