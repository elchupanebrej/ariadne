import type {
  MethodContract,
  CompletionProfile,
  VerificationHook,
} from "./schemas.js";

export * from "./schemas.js";

export interface MethodContractPin {
  version: string;
  digest: string;
  algorithm: "sha256";
}

export interface ResolvedObligations {
  artifacts: string[];
  receipts: string[];
  external_verification_receipts: string[];
  self_consistency_receipts: string[];
}

export interface ResolvedProfile {
  name: string;
  profile: CompletionProfile;
  contract?: MethodContract;
  obligations: ResolvedObligations;
  verification_hooks: VerificationHook[];
}

export interface ValidateMethodContractOptions {
  profile?: string;
  context?: {
    signals?: Record<string, boolean>;
    [key: string]: unknown;
  };
  expectedPin?: {
    version?: string;
    digest?: string;
  };
  checkRationale?: boolean;
  guideContentResolver?: (href: string) => string | null;
}

export interface MethodContractDiagnostic {
  path: string;
  message: string;
}

export interface MethodContractValidationSuccess {
  valid: true;
  contract: MethodContract;
  pin: MethodContractPin;
  normalized: string;
  profile?: ResolvedProfile;
}

export interface MethodContractValidationFailure {
  valid: false;
  problems: string[];
  diagnostics: MethodContractDiagnostic[];
}

export type MethodContractValidationResult =
  | MethodContractValidationSuccess
  | MethodContractValidationFailure;

export interface ProfileCompletionState {
  artifacts?: Record<string, unknown>;
  receipts?: string[];
}

export interface ProfileCompletionResult {
  complete: boolean;
  missingArtifacts: string[];
  invalidArtifacts: string[];
  missingReceipts: string[];
  problems: string[];
  externalVerificationPassed: boolean;
  selfConsistencyPassed: boolean;
}
