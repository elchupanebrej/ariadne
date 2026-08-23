import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  MethodContractSchema,
  type MethodContract,
  type VerificationHook,
} from "./schemas.js";
import type {
  MethodContractDiagnostic,
  MethodContractPin,
  MethodContractValidationResult,
  ProfileCompletionResult,
  ProfileCompletionState,
  ResolvedObligations,
  ResolvedProfile,
  ValidateMethodContractOptions,
} from "./types.js";

export const CANONICAL_EXTERNAL_VERIFICATION_RECEIPTS = [
  "external-verification",
] as const;

export const CANONICAL_SELF_CONSISTENCY_RECEIPTS = [
  "audit-49",
  "leave-one-out",
  "fixed-point",
  "no-circular-validation",
] as const;

export const EXTERNAL_VERIFICATION_RECEIPTS: Set<string> = new Set(
  CANONICAL_EXTERNAL_VERIFICATION_RECEIPTS,
);

export const SELF_CONSISTENCY_RECEIPTS: Set<string> = new Set(
  CANONICAL_SELF_CONSISTENCY_RECEIPTS,
);

const VALID_JSON_SCHEMA_TYPES = new Set([
  "object",
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "null",
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
 * Validate that an object is a well-formed JSON Schema fragment.
 */
export function validateJsonSchemaFragment(
  schema: unknown,
  basePath: string,
): MethodContractDiagnostic[] {
  const diagnostics: MethodContractDiagnostic[] = [];

  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    diagnostics.push({
      path: basePath,
      message: "JSON Schema predicate must be a non-null object",
    });
    return diagnostics;
  }

  const obj = schema as Record<string, unknown>;

  if (obj.type !== undefined) {
    if (typeof obj.type === "string") {
      if (!VALID_JSON_SCHEMA_TYPES.has(obj.type)) {
        diagnostics.push({
          path: `${basePath}.type`,
          message: `Invalid JSON Schema type "${obj.type}". Expected one of: ${Array.from(VALID_JSON_SCHEMA_TYPES).join(", ")}`,
        });
      }
    } else if (Array.isArray(obj.type)) {
      for (const t of obj.type) {
        if (typeof t !== "string" || !VALID_JSON_SCHEMA_TYPES.has(t)) {
          diagnostics.push({
            path: `${basePath}.type`,
            message: `Invalid JSON Schema type "${String(t)}" in type union`,
          });
        }
      }
    } else {
      diagnostics.push({
        path: `${basePath}.type`,
        message: "JSON Schema type must be a string or array of strings",
      });
    }
  }

  if (obj.required !== undefined) {
    if (!Array.isArray(obj.required)) {
      diagnostics.push({
        path: `${basePath}.required`,
        message: "JSON Schema required property must be an array of strings",
      });
    } else {
      for (let i = 0; i < obj.required.length; i++) {
        if (typeof obj.required[i] !== "string" || obj.required[i].trim() === "") {
          diagnostics.push({
            path: `${basePath}.required[${i}]`,
            message: "Required property names must be non-empty strings",
          });
        }
      }
    }
  }

  if (obj.properties !== undefined) {
    if (obj.properties === null || typeof obj.properties !== "object" || Array.isArray(obj.properties)) {
      diagnostics.push({
        path: `${basePath}.properties`,
        message: "JSON Schema properties must be an object",
      });
    } else {
      for (const [propKey, childSchema] of Object.entries(obj.properties as Record<string, unknown>)) {
        diagnostics.push(...validateJsonSchemaFragment(childSchema, `${basePath}.properties.${propKey}`));
      }
    }
  }

  return diagnostics;
}

function matchesPrimitiveType(type: string, val: unknown): boolean {
  switch (type) {
    case "string":
      return typeof val === "string";
    case "number":
      return typeof val === "number" && !Number.isNaN(val);
    case "integer":
      return typeof val === "number" && Number.isInteger(val);
    case "boolean":
      return typeof val === "boolean";
    case "array":
      return Array.isArray(val);
    case "object":
      return val !== null && typeof val === "object" && !Array.isArray(val);
    case "null":
      return val === null;
    default:
      return false;
  }
}

/**
 * Deterministic JSON Schema fragment matcher for rule triggers.
 */
export function matchesJsonSchemaPredicate(
  schema: Record<string, unknown>,
  value: unknown,
): boolean {
  if (schema.const !== undefined && value !== schema.const) {
    return false;
  }

  if (schema.enum !== undefined && Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      return false;
    }
  }

  if (schema.type !== undefined) {
    if (typeof schema.type === "string") {
      if (!matchesPrimitiveType(schema.type, value)) {
        return false;
      }
    } else if (Array.isArray(schema.type)) {
      const anyMatch = schema.type.some(
        (t) => typeof t === "string" && matchesPrimitiveType(t, value),
      );
      if (!anyMatch) return false;
    }
  }

  // If value is an object, validate required fields and child properties
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
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
  }

  return true;
}

/**
 * Classify receipts into external-verification and self-consistency classes.
 * Explicitly preserves separation without arbitrary fuzzy guessing.
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
    }
  }

  return { external, selfConsistency };
}

/**
 * Extract anchor IDs and headers from markdown content.
 */
function extractMarkdownAnchors(content: string): Set<string> {
  const anchors = new Set<string>();

  // Match <a id="..." or <a name="..." or id="..."
  const anchorRegex = /<(?:a|span|div)\s+[^>]*(?:id|name)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(content)) !== null) {
    anchors.add(match[1].toLowerCase());
  }

  // Match markdown headers: # Heading or # Heading {#custom-id}
  const headerRegex = /^#{1,6}\s+(.+)$/gm;
  while ((match = headerRegex.exec(content)) !== null) {
    const rawHeader = match[1].trim();
    // Check for explicit {#custom-id}
    const explicitIdMatch = /\{#([^}]+)\}/.exec(rawHeader);
    if (explicitIdMatch) {
      anchors.add(explicitIdMatch[1].toLowerCase());
    }
    // Generate standard slug
    const slug = rawHeader
      .replace(/\{#[^}]+\}/, "")
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    if (slug) {
      anchors.add(slug);
    }
  }

  return anchors;
}

/**
 * Validate that all rationale references resolve to existing anchors/documents.
 */
export function validateRationaleReferences(
  contract: MethodContract,
  options: ValidateMethodContractOptions,
): MethodContractDiagnostic[] {
  const diagnostics: MethodContractDiagnostic[] = [];
  const guideHref = contract.guide?.href;
  const shouldResolve = options.checkRationale !== false;

  const checkReference = (ref: string, path: string) => {
    if (!ref || typeof ref !== "string" || ref.trim() === "") {
      diagnostics.push({
        path,
        message: "Rationale reference must be a non-empty string",
      });
      return;
    }

    if (!shouldResolve) {
      return;
    }

    const trimmed = ref.trim();
    let targetDoc = guideHref;
    let anchor: string | undefined;

    if (trimmed.includes("#")) {
      const parts = trimmed.split("#");
      if (parts[0]) {
        targetDoc = parts[0];
      }
      anchor = parts[1];
    } else {
      targetDoc = trimmed;
    }

    let docContent: string | null = null;
    if (options.guideContentResolver) {
      docContent = options.guideContentResolver(targetDoc);
    } else if (existsSync(targetDoc)) {
      try {
        docContent = readFileSync(targetDoc, "utf-8");
      } catch {
        docContent = null;
      }
    } else if (existsSync(resolve(process.cwd(), targetDoc))) {
      try {
        docContent = readFileSync(resolve(process.cwd(), targetDoc), "utf-8");
      } catch {
        docContent = null;
      }
    }

    if (docContent === null) {
      diagnostics.push({
        path,
        message: `Unresolved rationale reference: guide document "${targetDoc}" not found`,
      });
      return;
    }

    if (anchor) {
      const availableAnchors = extractMarkdownAnchors(docContent);
      if (!availableAnchors.has(anchor.toLowerCase())) {
        diagnostics.push({
          path,
          message: `Unresolved rationale reference: anchor "#${anchor}" not found in "${targetDoc}"`,
        });
      }
    }
  };

  for (const [id, art] of Object.entries(contract.artifacts || {})) {
    checkReference(art.rationale_ref, `artifacts.${id}.rationale_ref`);
  }

  for (let i = 0; i < (contract.rules || []).length; i++) {
    checkReference(contract.rules[i].rationale_ref, `rules[${i}].rationale_ref`);
  }

  for (const [id, prof] of Object.entries(contract.completion_profiles || {})) {
    if (prof.rationale_ref) {
      checkReference(prof.rationale_ref, `completion_profiles.${id}.rationale_ref`);
    }
  }

  for (let i = 0; i < (contract.verification_hooks || []).length; i++) {
    checkReference(contract.verification_hooks[i].rationale_ref, `verification_hooks[${i}].rationale_ref`);
  }

  return diagnostics;
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
      contract,
      obligations,
      verification_hooks,
    },
  };
}

/**
 * Check profile completion against provided state artifacts and receipts.
 * Strictly verifies that external-verification and self-consistency cannot substitute for each other.
 */
export function checkProfileCompletion(
  resolved: ResolvedProfile,
  state: ProfileCompletionState,
): ProfileCompletionResult {
  const missingArtifacts: string[] = [];
  const invalidArtifacts: string[] = [];
  const missingReceipts: string[] = [];
  const problems: string[] = [];

  const providedArtifacts = state.artifacts ?? {};
  const providedReceipts = new Set<string>(state.receipts ?? []);

  // Check required artifacts
  for (const artifactId of resolved.obligations.artifacts) {
    const artifactValue = providedArtifacts[artifactId];
    if (artifactValue === undefined) {
      missingArtifacts.push(artifactId);
      problems.push(`Missing required artifact "${artifactId}"`);
    } else if (resolved.contract?.artifacts[artifactId]) {
      const schema = resolved.contract.artifacts[artifactId].schema;
      if (!matchesJsonSchemaPredicate(schema, artifactValue)) {
        invalidArtifacts.push(artifactId);
        problems.push(`Artifact "${artifactId}" does not satisfy its schema`);
      }
    }
  }

  // Check required receipts
  for (const receipt of resolved.obligations.receipts) {
    if (!providedReceipts.has(receipt)) {
      missingReceipts.push(receipt);
      problems.push(`Missing required receipt "${receipt}"`);
    }
  }

  const checkCategory = (requiredList: string[]) =>
    requiredList.every((r) => providedReceipts.has(r));

  const externalVerificationPassed = checkCategory(
    resolved.obligations.external_verification_receipts,
  );
  const selfConsistencyPassed = checkCategory(
    resolved.obligations.self_consistency_receipts,
  );

  const complete =
    missingArtifacts.length === 0 &&
    invalidArtifacts.length === 0 &&
    missingReceipts.length === 0 &&
    externalVerificationPassed &&
    selfConsistencyPassed;

  return {
    complete,
    missingArtifacts,
    invalidArtifacts,
    missingReceipts,
    problems,
    externalVerificationPassed,
    selfConsistencyPassed,
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

  // Validate JSON schema fragments in artifact schemas, rule triggers, and branches
  const schemaDiagnostics: MethodContractDiagnostic[] = [];
  for (const [id, art] of Object.entries(contract.artifacts)) {
    schemaDiagnostics.push(...validateJsonSchemaFragment(art.schema, `artifacts.${id}.schema`));
  }

  for (let i = 0; i < contract.rules.length; i++) {
    const rule = contract.rules[i];
    schemaDiagnostics.push(...validateJsonSchemaFragment(rule.trigger.schema, `rules[${i}].trigger.schema`));
    if (rule.branches) {
      for (let j = 0; j < rule.branches.length; j++) {
        schemaDiagnostics.push(...validateJsonSchemaFragment(rule.branches[j].when.schema, `rules[${i}].branches[${j}].when.schema`));
      }
    }
  }

  // Validate rationale references
  const rationaleDiagnostics = validateRationaleReferences(contract, options);

  const allDiagnostics = [...schemaDiagnostics, ...rationaleDiagnostics];
  if (allDiagnostics.length > 0) {
    return {
      valid: false,
      problems: allDiagnostics.map((d) => `${d.path}: ${d.message}`),
      diagnostics: allDiagnostics,
    };
  }

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

export function resolveMethodContract(
  input: unknown,
  options: ValidateMethodContractOptions = {},
): MethodContractValidationResult {
  const profile = options.profile ?? "pilot";
  return validateMethodContract(input, { ...options, profile });
}
