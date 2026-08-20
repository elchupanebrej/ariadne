import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AriadneEpistemicEnvelope } from "../../core/schemas/envelope.js";
import type { CliIO } from "../workspace.js";

const ACTIONS = ["send", "receive", "verify"] as const;
type EnvelopeAction = (typeof ACTIONS)[number];

export async function runEnvelope(args: readonly string[], io: CliIO): Promise<number> {
  const action = args[0] as EnvelopeAction | undefined;
  if (!action || !ACTIONS.includes(action) || args.length !== 2) {
    throw new Error("Usage: ariadne envelope <send|receive|verify> <file>");
  }

  const file = resolve(io.cwd, args[1]);
  let input: unknown;
  try {
    input = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new Error(
      `Invalid envelope JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = AriadneEpistemicEnvelope.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid AriadneEpistemicEnvelope: ${parsed.error.message}`);
  }

  io.stdout.write(
    `${JSON.stringify({
      operation: action,
      valid: true,
      envelope_id: parsed.data.envelope_id,
      envelope: parsed.data,
    })}\n`,
  );
  return 0;
}
