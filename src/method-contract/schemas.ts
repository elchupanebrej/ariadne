import { z } from "zod";

export const METHOD_CONTRACT_STATUSES = [
  "draft",
  "active",
  "deprecated",
  "retired",
] as const;

export const MethodContractFormatSchema = z.literal("method-contract/1");

export const MethodContractStatusSchema = z.enum(METHOD_CONTRACT_STATUSES);

export const GuidePointerSchema = z
  .object({
    href: z.string().min(1),
    role: z.string().min(1),
  })
  .strict();

export const ArtifactRecordSchema = z
  .object({
    id: z.string().min(1),
    role: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
    rationale_ref: z.string().min(1),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .strict();

export const RequireArtifactEffectSchema = z
  .object({
    kind: z.literal("require_artifact"),
    artifact: z.string().min(1),
  })
  .strict();

export const RequireReceiptEffectSchema = z
  .object({
    kind: z.literal("require_receipt"),
    receipt: z.string().min(1),
  })
  .strict();

export const EmitReceiptEffectSchema = z
  .object({
    kind: z.literal("emit_receipt"),
    receipt: z.string().min(1),
  })
  .strict();

export const SelectRuleEffectSchema = z
  .object({
    kind: z.literal("select_rule"),
    rule: z.string().min(1),
  })
  .strict();

export const StopEffectSchema = z
  .object({
    kind: z.literal("stop"),
    reason: z.string().min(1),
  })
  .strict();

export const SupportedEffectSchema = z.discriminatedUnion("kind", [
  RequireArtifactEffectSchema,
  RequireReceiptEffectSchema,
  EmitReceiptEffectSchema,
  SelectRuleEffectSchema,
  StopEffectSchema,
]);

export const RuleBranchSchema = z
  .object({
    when: z
      .object({
        target: z.string().min(1),
        schema: z.record(z.string(), z.unknown()),
      })
      .strict(),
    then: z.array(SupportedEffectSchema),
  })
  .strict();

export const RuleRecordSchema = z
  .object({
    id: z.string().min(1),
    trigger: z
      .object({
        target: z.string().min(1),
        schema: z.record(z.string(), z.unknown()),
      })
      .strict(),
    inputs: z.array(z.string().min(1)).optional(),
    action: z.array(SupportedEffectSchema).optional(),
    branches: z.array(RuleBranchSchema).optional(),
    output: z.record(z.string(), z.unknown()).optional(),
    recovery: z.union([z.string().min(1), z.record(z.string(), z.unknown())]).optional(),
    escalation: z.union([z.string().min(1), z.record(z.string(), z.unknown())]).optional(),
    rationale_ref: z.string().min(1),
  })
  .strict();

export const CompletionProfileSchema = z
  .object({
    require_artifacts: z.array(z.string().min(1)),
    require_receipts: z.array(z.string().min(1)),
    rationale_ref: z.string().min(1).optional(),
  })
  .strict();

export const VERIFICATION_HOOK_EVENTS = [
  "contract.load",
  "artifact.changed",
  "context.changed",
  "before.complete",
  "before.publish",
] as const;

export const VERIFICATION_HOOK_CHECKS = [
  "contract-meta-schema",
  "artifact-schema",
  "rule-triggers",
  "rationale-link-resolution",
  "completion-profile",
  "version-digest-pins",
  "owner-receipt",
] as const;

export const VerificationHookSchema = z
  .object({
    id: z.string().min(1),
    on: z.string().min(1),
    check: z.string().min(1),
    owner: z.string().min(1),
    required_receipt: z.string().min(1).optional(),
    rationale_ref: z.string().min(1),
  })
  .strict();

export const ChangeLogEntrySchema = z
  .object({
    version: z.string().min(1),
    date: z.string().min(1).optional(),
    summary: z.string().min(1),
    changes: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const RetirementPolicySchema = z
  .object({
    active_successor: z.string().min(1).optional(),
    deprecation_period: z.string().min(1).optional(),
  })
  .strict();

export const LifecycleSchema = z
  .object({
    owner: z.string().min(1),
    decision_rights: z
      .union([z.string().min(1), z.array(z.string().min(1))])
      .optional(),
    version: z.string().min(1).optional(),
    status: MethodContractStatusSchema.optional(),
    effective_date: z.string().min(1).optional(),
    predecessor: z.string().min(1).nullable().optional(),
    compatibility: z.string().min(1).optional(),
    review_triggers: z.array(z.string().min(1)).optional(),
    feedback_ref: z.string().min(1).optional(),
    change_log: z.array(ChangeLogEntrySchema).optional(),
    retirement: RetirementPolicySchema.optional(),
  })
  .strict();

export const MethodContractSchema = z
  .object({
    format: MethodContractFormatSchema,
    id: z.string().min(1),
    version: z.string().min(1),
    status: MethodContractStatusSchema,
    guide: GuidePointerSchema,
    artifacts: z.record(z.string(), ArtifactRecordSchema),
    rules: z.array(RuleRecordSchema),
    completion_profiles: z.record(z.string(), CompletionProfileSchema),
    verification_hooks: z.array(VerificationHookSchema),
    lifecycle: LifecycleSchema,
  })
  .strict();

export type MethodContractFormat = z.infer<typeof MethodContractFormatSchema>;
export type MethodContractStatus = z.infer<typeof MethodContractStatusSchema>;
export type GuidePointer = z.infer<typeof GuidePointerSchema>;
export type ArtifactRecord = z.infer<typeof ArtifactRecordSchema>;
export type SupportedEffect = z.infer<typeof SupportedEffectSchema>;
export type RuleBranch = z.infer<typeof RuleBranchSchema>;
export type RuleRecord = z.infer<typeof RuleRecordSchema>;
export type CompletionProfile = z.infer<typeof CompletionProfileSchema>;
export type VerificationHook = z.infer<typeof VerificationHookSchema>;
export type ChangeLogEntry = z.infer<typeof ChangeLogEntrySchema>;
export type RetirementPolicy = z.infer<typeof RetirementPolicySchema>;
export type Lifecycle = z.infer<typeof LifecycleSchema>;
export type MethodContract = z.infer<typeof MethodContractSchema>;
