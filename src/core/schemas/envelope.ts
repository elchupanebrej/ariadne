import { z } from "zod";
import {
  NodeIdSchema,
  ProvenanceTypeSchema,
} from "./nodes.js";

export const SENDER_ROLES = [
  "FramingAgent",
  "DiagnosticAgent",
  "ExplorationAgent",
  "ArchitectureAgent",
  "DynamicsAgent",
  "ImplementationAgent",
  "VerificationAgent",
  "AdversarialReviewerAgent",
] as const;

export const EPISTEMIC_MODES = ["Fast", "Standard", "Deep"] as const;

export const SenderRoleSchema = z.enum(SENDER_ROLES);
export const EpistemicModeSchema = z.enum(EPISTEMIC_MODES);

export const EmpiricalEvidenceSchema = z.object({
  test_command: z.string().optional(),
  stdout_digest: z.string().optional(),
  raw_metric_value: z.number().optional(),
  reproducible_environment: z.string().optional(),
});

export const ProvenancePayloadSchema = z.object({
  node_id: NodeIdSchema,
  provenance_type: ProvenanceTypeSchema,
  statement: z.string().min(1),
  confidence_level: z.number().min(0).max(1),
  dependencies: z.array(z.string()).optional(),
  falsification_conditions: z.array(z.string()).optional(),
  empirical_evidence: EmpiricalEvidenceSchema.optional(),
});

export const AriadneEpistemicEnvelope = z.object({
  envelope_id: z.string().uuid(),
  correlation_id: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
  sender_role: SenderRoleSchema,
  target_role: z.string().min(1),
  epistemic_mode: EpistemicModeSchema,
  provenance_payload: ProvenancePayloadSchema,
}).meta({ title: "AriadneEpistemicEnvelope" });

export const AriadneEpistemicEnvelopeSchema = AriadneEpistemicEnvelope;
export const EnvelopeSchema = AriadneEpistemicEnvelope;
export type AriadneEpistemicEnvelope = z.infer<
  typeof AriadneEpistemicEnvelope
>;
export type ProvenancePayload = z.infer<typeof ProvenancePayloadSchema>;
