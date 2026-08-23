import { createHash } from "node:crypto";
import {
  MethodContractSchema,
  type MethodContract,
  type VerificationHook,
} from "./schemas.js";
import type {
  MethodContractPin,
  MethodContractValidationResult,
  ResolvedObligations,
  ResolvedProfile,
  ValidateMethodContractOptions,
} from "./types.js";

export const EXTERNAL_VERIFICATION_RECEIPTS = new Set([
  "external-verification",
  "user-test",
  "expert-review",
  "pilot-implementation",
  "performance-assessment",
  "empirical-validation",
]);

export const SELF_CONSISTENCY_RECEIPTS = new Set([
  "audit-49",
  "leave-one-out",
  "fixed-point",
  "no-circular-validation",
  "structural-closure",
]);

/**
 * Deterministically sort object keys recursively for canonical normalization.
 */
export function canonicalizeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalizeValue(obj[key]);
  }
  return result;
}

/**
 * Deterministic canonical JSON stringifier.
 */
export function canonicalNormalize(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value), null, 2);
}

/**
 * Compute SHA-256 byte digest in standard "sha256:<hex>" form.
 */
export function calculateByteDigest(input: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof input === "string") {
    hash.update(Buffer.from(input, "utf-8"));
  } else {
    hash.update(input);
  }
  return `sha256:${hash.digest("hex")}`;
}

/**
 * Simple JSON Schema fragment matcher for rule triggers.
 */
export function matchesJsonSchemaPredicate(
  schema: Record<string, unknown>,
  value: unknown,
): boolean {
  if (schema.const !== undefined && value !== schema.const) {
    return false;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return schema.type === undefined || schema.type !== "object";
  }

  const rec = value as Record<string, unknown>;

  if (Array.isArray(schema.required)) {
    for (const key of schema.required as string[]) {
      if (!(key in rec)) return false;
    }
  }

  if (schema.properties && typeof schema.properties === "object") {
    for (const [prop, childSchema] of Object.entries(
      schema.properties as Record<string, Record<string, unknown>>,
    )) {
      if (rec[prop] !== undefined) {
        if (!matchesJsonSchemaPredicate(childSchema, rec[prop])) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Classify receipts into external-verification and self-consistency classes.
 * Explicitly preserves separation without arbitrary fuzzy inference.
 */
export function classifyReceipts(receipts: string[]): {
  external: string[];
  selfConsistency: string[];
} {
  const external: string[] = [];
  const selfConsistency: string[] = [];

  for (const receipt of receipts) {
    if (EXTERNAL_VERIFICATION_RECEIPTS.has(receipt)) {
      external.push(receipt);
    } else if (SELF_CONSISTENCY_RECEIPTS.has(receipt)) {
      selfConsistency.push(receipt);
    } else {
      // Non-standard/custom receipts: do not silently assign to self-consistency
      external.push(receipt);
    }
  }

  return { external, selfConsistency };
}

/**
 * Resolve profile obligations and hooks given a validated contract and evaluation context.
 */
export function resolveProfile(
  contract: MethodContract,
  profileName: string,
  context?: Record<string, unknown>,
): {
  profile?: ResolvedProfile;
  problem?: string;
} {
  const profileConfig = contract.completion_profiles[profileName];
  if (!profileConfig) {
    return {
      problem: `Unknown completion profile "${profileName}". Available profiles: ${Object.keys(
        contract.completion_profiles,
      ).join(", ")}`,
    };
  }

  const requiredArtifactsSet = new Set<string>(profileConfig.require_artifacts);
  const requiredReceiptsSet = new Set<string>(profileConfig.require_receipts);

  // Evaluate rule triggers against provided context
  if (context) {
    for (const rule of contract.rules) {
      const targetValue =
        rule.trigger.target === "context"
          ? context
          : context[rule.trigger.target];

      if (
        targetValue !== undefined &&
        matchesJsonSchemaPredicate(rule.trigger.schema, targetValue)
      ) {
        // Collect from action effects
        if (rule.action) {
          for (const act of rule.action) {
            if (act.kind === "require_artifact") {
              requiredArtifactsSet.add(act.artifact);
            } else if (act.kind === "require_receipt") {
              requiredReceiptsSet.add(act.receipt);
            }
          }
        }
      }
    }
  }

  const allArtifacts = Array.from(requiredArtifactsSet);
  const allReceipts = Array.from(requiredReceiptsSet);
  const classified = classifyReceipts(allReceipts);

  const obligations: ResolvedObligations = {
    artifacts: allArtifacts,
    receipts: allReceipts,
    external_verification_receipts: classified.external,
    self_consistency_receipts: classified.selfConsistency,
  };

  const verification_hooks: VerificationHook[] = contract.verification_hooks;

  return {
    profile: {
      name: profileName,
      profile: profileConfig,
      obligations,
      verification_hooks,
    },
  };
}

/**
 * Public validation boundary for Method Contract manifests.
 */
export function validateMethodContract(
  input: unknown,
  options: ValidateMethodContractOptions = {},
): MethodContractValidationResult {
  let rawBytes: string | Uint8Array | null = null;
  let parsedObject: unknown;

  if (typeof input === "string") {
    rawBytes = input;
    try {
      parsedObject = JSON.parse(input);
    } catch (err) {
      return {
        valid: false,
        problems: [
          `Invalid JSON input: ${err instanceof Error ? err.message : String(err)}`,
        ],
        diagnostics: [
          {
            path: "$",
            message: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  } else if (input instanceof Uint8Array || Buffer.isBuffer(input)) {
    rawBytes = input;
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(input);
      parsedObject = JSON.parse(decoded);
    } catch (err) {
      return {
        valid: false,
        problems: [
          `Invalid UTF-8 or JSON input: ${err instanceof Error ? err.message : String(err)}`,
        ],
        diagnostics: [
          {
            path: "$",
            message: `UTF-8 / JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  } else if (input && typeof input === "object") {
    parsedObject = input;
  } else {
    return {
      valid: false,
      problems: ["Input must be a JSON string, Buffer, or object"],
      diagnostics: [
        {
          path: "$",
          message: "Input must be a JSON string, Buffer, or object",
        },
      ],
    };
  }

  const parseResult = MethodContractSchema.safeParse(parsedObject);
  if (!parseResult.success) {
    const problems = parseResult.error.issues.map(
      (issue) => `${issue.path.join(".") || "$"}: ${issue.message}`,
    );
    const diagnostics = parseResult.error.issues.map((issue) => ({
      path: issue.path.join(".") || "$",
      message: issue.message,
    }));
    return {
      valid: false,
      problems,
      diagnostics,
    };
  }

  const contract = parseResult.data;

  // Compute byte digest
  const digest = rawBytes
    ? calculateByteDigest(rawBytes)
    : calculateByteDigest(canonicalNormalize(contract));

  const pin: MethodContractPin = {
    version: contract.version,
    digest,
    algorithm: "sha256",
  };

  // Check expected pin if provided
  if (options.expectedPin) {
    if (
      options.expectedPin.version &&
      options.expectedPin.version !== pin.version
    ) {
      return {
        valid: false,
        problems: [
          `Pin version mismatch: expected ${options.expectedPin.version}, got ${pin.version}`,
        ],
        diagnostics: [
          {
            path: "version",
            message: `Expected version ${options.expectedPin.version} but found ${pin.version}`,
          },
        ],
      };
    }
    if (options.expectedPin.digest && options.expectedPin.digest !== pin.digest) {
      return {
        valid: false,
        problems: [
          `Pin digest mismatch: expected ${options.expectedPin.digest}, got ${pin.digest}`,
        ],
        diagnostics: [
          {
            path: "digest",
            message: `Expected digest ${options.expectedPin.digest} but found ${pin.digest}`,
          },
        ],
      };
    }
  }

  let resolvedProfile: ResolvedProfile | undefined;
  if (options.profile) {
    const profileRes = resolveProfile(
      contract,
      options.profile,
      options.context,
    );
    if (profileRes.problem) {
      return {
        valid: false,
        problems: [profileRes.problem],
        diagnostics: [
          {
            path: "completion_profiles",
            message: profileRes.problem,
          },
        ],
      };
    }
    resolvedProfile = profileRes.profile;
  }

  return {
    valid: true,
    contract,
    pin,
    normalized: canonicalNormalize(contract),
    profile: resolvedProfile,
  };
}

/**
 * Public resolution boundary that validates and resolves a Method Contract with an active profile.
 */
export function resolveMethodContract(
  input: unknown,
  options: ValidateMethodContractOptions = {},
): MethodContractValidationResult {
  const profile = options.profile ?? "pilot";
  return validateMethodContract(input, { ...options, profile });
}
