import { AriadneError, formatDiagnostic, isAriadneError } from "../core/errors.js";
import { redactSecrets } from "../core/exec.js";
import type { CliIO } from "./workspace.js";

export type { CliIO } from "./workspace.js";

export const CLI_VERSION = "0.2.0";

export const CLI_HELP = `Ariadne ${CLI_VERSION}

Usage:
  ariadne init [--root <path>]
  ariadne status [--format json]
  ariadne node (add|update|get|list|remove) [options]
  ariadne edge (add|remove|list) [options]
  ariadne waive <node-id> --by <decision-id>
  ariadne supersede <node-id> --by <decision-id>
  ariadne invalidate <node-id> --by <evidence-id>
  ariadne gate <name> [--format json]
  ariadne verify [--format json]
  ariadne ingest <file> [--type <type>]
  ariadne report [--format (json|markdown)] [--out <path>]
  ariadne viz [--format (dot|svg|mermaid)]
  ariadne template (init|apply|list) [options]
  ariadne migrate [--dry-run] [--rollback <id>]
  ariadne merge-driver <ancestor> <current> <other> <result>
  ariadne merge-resolve [--auto]
  ariadne merge-setup [--hooks]
  ariadne merge-doctor
  ariadne merge-check
  ariadne merge-sync

Options:
  -h, --help       Show this help
  -v, --version    Show the CLI version
`;

export type CliOutputFormat = "human" | "json";

export type OptionSpec = {
  name: string;
  takesValue?: boolean;
};

export type ParsedOptions = {
  positionals: string[];
  values: Map<string, string>;
  flags: Set<string>;
};

export const syntaxError = (message: string, repair?: string): AriadneError =>
  new AriadneError({
    code: "INVALID_INPUT",
    message,
    ...(repair === undefined ? {} : { repair }),
  });

export const missingDataError = (message: string, detail?: Record<string, unknown>): AriadneError =>
  new AriadneError({
    code: "MISSING_DATA",
    message,
    ...(detail === undefined ? {} : { detail }),
  });

export const parseOptions = (
  args: readonly string[],
  specs: readonly OptionSpec[],
  usage: string,
): ParsedOptions => {
  const byName = new Map(specs.map((spec) => [`--${spec.name}`, spec]));
  const positionals: string[] = [];
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    const optionName = equals === -1 ? arg : arg.slice(0, equals);
    const inlineValue = equals === -1 ? undefined : arg.slice(equals + 1);
    const spec = byName.get(optionName);
    if (!spec) throw syntaxError(`Unknown option: ${arg}. ${usage}`);
    if (spec.takesValue) {
      const value = inlineValue ?? args[index + 1];
      if (value === undefined || value === "" || value.startsWith("--")) {
        throw syntaxError(`Option ${optionName} requires a value. ${usage}`);
      }
      if (values.has(spec.name)) {
        throw syntaxError(`Option ${optionName} may be specified only once. ${usage}`);
      }
      values.set(spec.name, value);
      if (inlineValue === undefined) index += 1;
    } else {
      if (inlineValue !== undefined) {
        throw syntaxError(`Option ${optionName} does not take a value. ${usage}`);
      }
      if (flags.has(spec.name)) {
        throw syntaxError(`Option ${optionName} may be specified only once. ${usage}`);
      }
      flags.add(spec.name);
    }
  }
  return { positionals, values, flags };
};

export const hasHelp = (
  args: readonly string[],
  valueFlags: readonly string[] = [],
): boolean => {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") return true;
    if (valueFlags.includes(arg)) index += 1;
  }
  return false;
};

export const parseOutputFormat = <T extends string>(
  args: readonly string[],
  allowed: readonly T[],
  defaultFormat: T,
  usage: string,
): { format: T; rest: string[] } => {
  const rest: string[] = [];
  let format: T = defaultFormat;
  let seen = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const inlineValue = arg.startsWith("--format=") ? arg.slice("--format=".length) : undefined;
    if (arg !== "--format" && inlineValue === undefined) {
      rest.push(arg);
      continue;
    }
    if (seen) throw syntaxError(`Option --format may be specified only once. ${usage}`);
    const value = inlineValue ?? args[++index];
    if (value === undefined || !allowed.includes(value as T)) {
      throw syntaxError(`Option --format expects one of ${allowed.join(", ")}. ${usage}`);
    }
    format = value as T;
    seen = true;
  }
  return { format, rest };
};

export const writeDomainDiagnostic = (
  io: CliIO,
  format: CliOutputFormat,
  code: "GATE_FAILED" | "MERGE_DIVERGED" | "PROJECTION_RECOVERY_NEEDED" | "COMMAND_FAILED",
  message: string,
  detail?: Record<string, unknown>,
): void => {
  const diagnostic = new AriadneError({
    code,
    message: redactSecrets(message),
    ...(detail === undefined ? {} : { detail: redactDetail(detail) }),
  });
  io.stderr.write(formatDiagnostic(diagnostic, { json: format === "json" }).text);
};

export const normalizeCliError = (error: unknown): unknown => {
  if (isAriadneError(error)) {
    return new AriadneError({
      code: error.code,
      message: redactSecrets(error.message),
      ...(error.repair === undefined ? {} : { repair: redactSecrets(error.repair) }),
      ...(error.detail === undefined ? {} : { detail: redactDetail(error.detail) }),
    });
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "ENOENT") {
      const path = "path" in error && typeof error.path === "string" ? error.path : undefined;
      return missingDataError(
        "Required Ariadne data was not found.",
        path === undefined ? undefined : { path: redactSecrets(path) },
      );
    }
    if (code === "EACCES" || code === "EPERM") {
      return new AriadneError({
        code: "PERMISSION_DENIED",
        message: "Ariadne does not have permission to access the requested resource.",
        detail: redactDetail(error),
      });
    }
    if (code === "ELOOP") {
      return new AriadneError({
        code: "PATH_ESCAPE",
        message: "The requested path escapes the Ariadne workspace boundary.",
        detail: redactDetail(error),
      });
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return new AriadneError({
    code: "INVARIANT_VIOLATION",
    message: redactSecrets(message),
  });
};

const redactDetail = (value: unknown): Record<string, unknown> => {
  const redact = (candidate: unknown): unknown => {
    if (typeof candidate === "string") return redactSecrets(candidate);
    if (Array.isArray(candidate)) return candidate.map(redact);
    if (candidate !== null && typeof candidate === "object") {
      return Object.fromEntries(
        Object.entries(candidate).map(([key, child]) => [key, redact(child)]),
      );
    }
    return candidate;
  };
  const result = redact(value);
  return result !== null && typeof result === "object" && !Array.isArray(result)
    ? result as Record<string, unknown>
    : { value: result };
};
