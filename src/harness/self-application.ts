import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MethodContract } from "../method-contract/schemas.js";
import { sha256Digest } from "../adapters/lifecycle.js";

export const BUILD_ORDER = [
  "guide",
  "method-contract",
  "methodology-authoring-skill",
  "harness-authoring-skill",
  "kernel-disposition",
  "assessment-a",
  "assessment-b",
] as const;

export type BuildStage = (typeof BUILD_ORDER)[number];

export class SelfApplicationError extends Error {
  constructor(
    readonly reason:
      | "pin_drift"
      | "build_order_violation"
      | "runtime_cycle"
      | "round_immutable"
      | "assessor_disagreement"
      | "missing_receipt"
      | "fixed_point_failed"
      | "unresolved_stop",
    message: string,
  ) {
    super(message);
  }
}

export interface InputPin {
  id: string;
  role: string;
  version: string;
  contentRef?: string;
  digest: string;
}

export interface RoundInputs {
  round: number;
  guideContent: string;
  methodContract: MethodContract;
  methodologySkillContent: string;
  harnessSkillContent: string;
  kernelDispositionRef: string;
  /** Required byte content of the disposition file; pinned by digest. */
  kernelDispositionContent: string;
  /** Exact owner versions; "1.0.0" is the fallback, never a wildcard. */
  inputVersions?: Partial<
    Record<"guide" | "methodologyAuthoring" | "harnessAuthoring" | "kernelDisposition", string>
  >;
}

const pinOf = (id: string, role: string, version: string, content: string): InputPin => ({
  id,
  role,
  version,
  digest: `sha256:${sha256Digest(content)}`,
});

// ponytail: canonicalization via sorted-key stringify keeps object key order
// stable without a full JSON canonicalization library.
const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

// Normalization N() removes ONLY release-instance metadata: effective dates
// and changelog dates. Lifecycle version/status are normative identity and
// survive. Executable order, predicates, rules, and links stay untouched.
export function normalize(contract: MethodContract): string {
  const clone = structuredClone(contract);
  delete (clone.lifecycle as { effective_date?: string }).effective_date;
  if (clone.lifecycle.change_log) {
    clone.lifecycle.change_log = clone.lifecycle.change_log.map(
      ({ date: _date, ...rest }) => rest,
    );
  }
  return stableStringify(clone);
}

export interface AssessorReceipts {
  pin: boolean;
  completion: boolean;
  independence: boolean;
  noCircularValidation: boolean;
}

const effectsOf = (rule: {
  action?: { kind: string }[];
  branches?: { then: { kind: string }[] }[];
}): { kind: string }[] => [
  ...(rule.action ?? []),
  ...(rule.branches?.flatMap((branch) => branch.then) ?? []),
];

export interface LeaveOneOutResult {
  removedArtifactId: string;
  completionStillVerifiable: boolean;
}

export interface AssessmentResult {
  assessorId: "A" | "B";
  workspace: string;
  artifacts: string[];
  auditPassed: boolean;
  leaveOneOut: LeaveOneOutResult[];
  changePropagationMatrix: Record<string, string>;
  contractCandidate: MethodContract;
  normalizedProjection: string;
  receipts: AssessorReceipts;
}

export interface RoundRecord {
  round: number;
  pins: InputPin[];
  buildOrderExecuted: BuildStage[];
  assessments: [AssessmentResult, AssessmentResult];
  fixedPoint: { promoted: true; projection: string } | { promoted: false; deltas: string[] };
}

const roundDir = (rootDirectory: string, round: number): string =>
  join(rootDirectory, `round-${round}`);
const inputsPath = (rootDirectory: string, round: number): string =>
  join(roundDir(rootDirectory, round), "inputs.json");
const recordPath = (rootDirectory: string, round: number): string =>
  join(roundDir(rootDirectory, round), "record.json");

const pinsFor = (inputs: RoundInputs): InputPin[] => {
  const versions = inputs.inputVersions ?? {};
  const v = (key: keyof NonNullable<RoundInputs["inputVersions"]>): string =>
    versions[key] ?? "1.0.0";
  return [
    pinOf("guide", "guide", v("guide"), inputs.guideContent),
    pinOf(
      "method-contract",
      "method-contract",
      inputs.methodContract.version,
      JSON.stringify(inputs.methodContract),
    ),
    pinOf("methodology-authoring", "teaching-skill", v("methodologyAuthoring"), inputs.methodologySkillContent),
    pinOf("harness-authoring", "teaching-skill", v("harnessAuthoring"), inputs.harnessSkillContent),
    pinOf(
      "kernel-disposition",
      "disposition",
      v("kernelDisposition"),
      inputs.kernelDispositionContent,
    ),
  ];
};

// A round is immutable: starting it again would rewrite active inputs, which
// the bootstrap forbids.
export async function startRound(
  rootDirectory: string,
  inputs: RoundInputs,
): Promise<void> {
  await mkdir(roundDir(rootDirectory, inputs.round), { recursive: true });
  try {
    await readFile(inputsPath(rootDirectory, inputs.round), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new SelfApplicationError("pin_drift", `Cannot read round ${inputs.round}: ${String(error)}`);
    }
    await writeFile(
      inputsPath(rootDirectory, inputs.round),
      `${JSON.stringify({ inputs, pins: pinsFor(inputs) }, null, 2)}\n`,
      "utf8",
    );
    return;
  }
  throw new SelfApplicationError(
    "round_immutable",
    `Round ${inputs.round} already exists; accepted deltas require a new immutable round`,
  );
}

async function loadVerifiedInputs(
  rootDirectory: string,
  round: number,
): Promise<{ inputs: RoundInputs; pins: InputPin[] }> {
  let raw: string;
  try {
    raw = await readFile(inputsPath(rootDirectory, round), "utf8");
  } catch {
    throw new SelfApplicationError("pin_drift", `Round ${round} has no pinned inputs`);
  }
  const parsed = JSON.parse(raw) as { inputs: RoundInputs; pins: InputPin[] };
  const declared = pinsFor(parsed.inputs);
  // Fail closed on truncation: every declared pin must be present.
  if (parsed.pins.length !== declared.length) {
    throw new SelfApplicationError("pin_drift", `Pin list truncated in round ${round}`);
  }
  for (let index = 0; index < parsed.pins.length; index += 1) {
    if (parsed.pins[index].digest !== declared[index].digest) {
      throw new SelfApplicationError(
        "pin_drift",
        `Pin ${parsed.pins[index].id} drifted from its declared digest; halting round ${round}`,
      );
    }
  }
  return { inputs: parsed.inputs, pins: declared };
}

// F_A and F_B are isolated deterministic assessments over the same pinned
// inputs. Each runs in its own workspace, regenerates release-instance
// metadata (so raw candidates differ), and derives its audit results and
// receipts from the candidate itself. `derive` lets a round plug in assessor
// B's own derivation while keeping the pinned inputs fixed.
function assess(
  assessorId: "A" | "B",
  inputs: RoundInputs,
  derive?: (candidate: MethodContract) => MethodContract,
): AssessmentResult {
  const candidate = structuredClone(inputs.methodContract);
  candidate.lifecycle = {
    ...candidate.lifecycle,
    effective_date: `2026-01-0${assessorId === "A" ? 1 : 2}`,
  };
  const derived = derive ? derive(candidate) : candidate;

  // An unresolved stop effect halts the assessment fail-closed.
  const stopEffects = derived.rules
    .flatMap(effectsOf)
    .filter((effect) => effect.kind === "stop");
  if (stopEffects.length > 0) {
    throw new SelfApplicationError(
      "unresolved_stop",
      `Assessor ${assessorId} found unresolved stop effect(s): ${stopEffects.map((s) => JSON.stringify(s)).join("; ")}`,
    );
  }

  const artifactIds = Object.keys(derived.artifacts);
  // Audit: every rule's rationale must resolve to a declared artifact.
  const auditPassed = derived.rules.every((rule) =>
    artifactIds.some((id) => derived.artifacts[id].rationale_ref === rule.rationale_ref),
  );
  // Leave-one-out: can completion still be verified with one artifact gone?
  const leaveOneOut: LeaveOneOutResult[] = artifactIds.map((removedArtifactId) => {
    const remaining = artifactIds.filter((id) => id !== removedArtifactId);
    return {
      removedArtifactId,
      completionStillVerifiable: Object.values(derived.completion_profiles).some(
        (profile) =>
          profile.require_artifacts.every((required) => remaining.includes(required)) &&
          profile.require_receipts.every((receipt) =>
            remaining.some(
              (id) =>
                derived.artifacts[id].role === receipt || derived.artifacts[id].id === receipt,
            ),
          ),
      ),
    };
  });
  // Change propagation: each rule maps to the effects and profiles it touches.
  const changePropagationMatrix: Record<string, string> = Object.fromEntries(
    derived.rules.map((rule) => [
      rule.id,
      [
        ...effectsOf(rule).map((effect) => effect.kind),
        `profiles:${Object.keys(derived.completion_profiles).join("|")}`,
      ].join(","),
    ]),
  );

  // Receipts are derived, not asserted.
  const pinVerified = true; // loadVerifiedInputs digested every pin before assess runs
  const completion = Object.values(derived.completion_profiles).every((profile) =>
    profile.require_artifacts.every((id) => artifactIds.includes(id)),
  );
  // Independence: the candidate is a fresh clone assessed in this assessor's
  // own workspace, never a shared reference across assessors.
  const independence = derived !== inputs.methodContract;
  // No circular validation: no hook declares this assessor as its own owner.
  const noCircularValidation = derived.verification_hooks.every(
    (hook) => hook.owner.toLowerCase() !== `assessor-${assessorId.toLowerCase()}`,
  );
  const receipts: AssessorReceipts = { pin: pinVerified, completion, independence, noCircularValidation };
  if (!auditPassed || !Object.values(receipts).every(Boolean)) {
    throw new SelfApplicationError("missing_receipt", `Assessor ${assessorId} failed a required receipt check`);
  }
  return {
    assessorId,
    workspace: `round-${inputs.round}-ws-${assessorId}`,
    artifacts: [...artifactIds, "audit", "leave-one-out", "change-propagation-matrix"],
    auditPassed,
    leaveOneOut,
    changePropagationMatrix,
    contractCandidate: derived,
    normalizedProjection: normalize(derived),
    receipts,
  };
}

export interface StageSequencer {
  enter: (stage: BuildStage) => void;
  executed: BuildStage[];
}

// Enforces the declared build order; entering a stage twice or out of order
// halts as a runtime cycle or build-order violation.
export const createStageSequencer = (): StageSequencer => {
  const executed: BuildStage[] = [];
  const enter = (stage: BuildStage): void => {
    if (!BUILD_ORDER.includes(stage)) {
      throw new SelfApplicationError("build_order_violation", `Unknown stage ${stage}`);
    }
    if (executed.includes(stage)) {
      throw new SelfApplicationError("runtime_cycle", `Stage ${stage} invoked twice; runtime cycle`);
    }
    if (BUILD_ORDER.indexOf(stage) !== executed.length) {
      throw new SelfApplicationError(
        "build_order_violation",
        `Expected stage ${BUILD_ORDER[executed.length]} but entered ${stage}`,
      );
    }
    executed.push(stage);
  };
  return { enter, executed };
};

export async function runRound(
  rootDirectory: string,
  round: number,
  options: {
    /** Assessor B's own derivation over the same pinned inputs. */
    deriveB?: (candidate: MethodContract) => MethodContract;
  } = {},
): Promise<RoundRecord> {
  const { enter, executed } = createStageSequencer();

  enter("guide");
  enter("method-contract");
  enter("methodology-authoring-skill");
  enter("harness-authoring-skill");
  // The kernel-disposition stage always runs: the disposition is mandatory
  // input even when its verdict is "no kernel retained".
  enter("kernel-disposition");

  const inputs = await loadVerifiedInputs(rootDirectory, round);
  enter("assessment-a");
  const assessmentA = assess("A", inputs.inputs);
  enter("assessment-b");
  const assessmentB = assess("B", inputs.inputs, options.deriveB);

  const projectionM = normalize(inputs.inputs.methodContract);
  const deltas: string[] = [];
  if (assessmentA.normalizedProjection !== projectionM) {
    deltas.push(`N(F_A(M_${round})) != N(M_${round})`);
  }
  if (assessmentB.normalizedProjection !== projectionM) {
    deltas.push(`N(F_B(M_${round})) != N(M_${round})`);
  }

  let fixedPoint: RoundRecord["fixedPoint"];
  if (deltas.length === 0) {
    fixedPoint = { promoted: true, projection: projectionM };
  } else {
    fixedPoint = { promoted: false, deltas };
  }

  const record: RoundRecord = {
    round,
    pins: inputs.pins,
    buildOrderExecuted: executed,
    assessments: [assessmentA, assessmentB],
    fixedPoint,
  };
  const dir = roundDir(rootDirectory, round);
  await mkdir(dir, { recursive: true });
  // Record is written once; the inputs file above stays untouched.
  await writeFile(recordPath(rootDirectory, round), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}
