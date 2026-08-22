import { hasHelp, type CliIO } from "../workspace.js";

export const OPERATION_RULES = {
  frame: "rules/10-frame.md",
  diagnose: "rules/20-diagnose.md",
  transform: "rules/30-transform.md",
  explore: "rules/40-explore.md",
  knowledge: "rules/50-knowledge.md",
  dependencies: "rules/60-dependencies.md",
  dynamics: "rules/70-dynamics.md",
  value: "rules/80-value.md",
  validate: "rules/90-validate.md",
} as const;

export type AriadneOperation = keyof typeof OPERATION_RULES;

const OP_USAGE =
  "Usage: ariadne op <frame|diagnose|transform|explore|knowledge|dependencies|dynamics|value|validate>\n";

export function runOperation(args: readonly string[], io: CliIO): number {
  if (hasHelp(args)) {
    io.stdout.write(OP_USAGE);
    return 0;
  }
  const operation = args[0] as AriadneOperation | undefined;
  if (!operation || args.length !== 1 || !(operation in OPERATION_RULES)) {
    throw new Error(OP_USAGE.trim());
  }
  io.stdout.write(`${JSON.stringify({ operation, rule: OPERATION_RULES[operation] })}\n`);
  return 0;
}
