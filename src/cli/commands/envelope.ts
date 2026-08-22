import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AriadneEpistemicEnvelope } from "../../core/schemas/envelope.js";
import { hasHelp, type CliIO } from "../workspace.js";

const ACTIONS = ["send", "receive", "verify"] as const;
type EnvelopeAction = (typeof ACTIONS)[number];

const ENVELOPE_USAGE = "Usage: ariadne envelope <send|receive|verify> <file>\n";
const ENVELOPE_SEND_USAGE = "Usage: ariadne envelope send <file>\n";
const ENVELOPE_RECEIVE_USAGE = "Usage: ariadne envelope receive <file>\n";
const ENVELOPE_VERIFY_USAGE = "Usage: ariadne envelope verify <file>\n";

export async function runEnvelope(args: readonly string[], io: CliIO): Promise<number> {
  const action = args[0];
  if (action === "-h" || action === "--help") {
    io.stdout.write(ENVELOPE_USAGE);
    return 0;
  }
  if (action === "send" && hasHelp(args.slice(1))) {
    io.stdout.write(ENVELOPE_SEND_USAGE);
    return 0;
  }
  if (action === "receive" && hasHelp(args.slice(1))) {
    io.stdout.write(ENVELOPE_RECEIVE_USAGE);
    return 0;
  }
  if (action === "verify" && hasHelp(args.slice(1))) {
    io.stdout.write(ENVELOPE_VERIFY_USAGE);
    return 0;
  }
  if (!action || !ACTIONS.includes(action as EnvelopeAction) || args.length !== 2) {
    throw new Error(ENVELOPE_USAGE.trim());
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
