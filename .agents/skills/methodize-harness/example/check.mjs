import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(`\x1b[31mFAIL: ${message}\x1b[0m`);
  process.exit(1);
}

function pass(message) {
  console.log(`\x1b[32mPASS: ${message}\x1b[0m`);
}

// 1. Check required package files
const filesToCheck = [
  "../SKILL.md",
  "../references/harness-research.md",
  "README.md",
  "input/dependency-review-run.json",
  "solution/harness-project.json",
  "check.mjs",
];

for (const relPath of filesToCheck) {
  const fullPath = resolve(__dirname, relPath);
  if (!existsSync(fullPath)) {
    fail(`Missing required file: ${relPath}`);
  }
}
pass("All required package files exist");

// 2. Validate solution/harness-project.json
const solutionPath = resolve(__dirname, "solution/harness-project.json");
let project;
try {
  project = JSON.parse(readFileSync(solutionPath, "utf-8"));
} catch (e) {
  fail(`Failed to parse solution/harness-project.json: ${e.message}`);
}

if (project.format !== "harness-project/1") {
  fail(`Invalid format: expected 'harness-project/1', got '${project.format}'`);
}

if (!project.source_pins?.method_contract_digest || !project.source_pins?.harness_research_digest) {
  fail("Source pins must contain method_contract and harness_research digests");
}

if (
  !project.outcome_requirements?.success_outcomes?.length ||
  !project.outcome_requirements?.failure_outcomes?.length ||
  !project.outcome_requirements?.waiting_outcomes?.length ||
  !project.outcome_requirements?.stop_outcomes?.length
) {
  fail("Outcome requirements must define success, failure, waiting, and stop outcomes");
}

const owners = ["method", "tracker", "ariadne", "host", "orchestration_harness"];
for (const o of owners) {
  if (!project.ownership_map?.[o]?.retained_responsibilities?.length) {
    fail(`Owner '${o}' missing retained responsibilities`);
  }
}

const harnessProhibited = project.ownership_map.orchestration_harness.prohibited_responsibilities.join(" ").toLowerCase();
if (!harnessProhibited.includes("copying") && !harnessProhibited.includes("shadow")) {
  fail("Orchestration harness must prohibit copying owner state / shadow state");
}

if (project.candidate_selection?.selected_candidate !== "minimal_neutral_kernel") {
  fail("Candidate selection must select minimal_neutral_kernel for cross-session continuation failure");
}

if (!project.triggered_mechanisms || project.triggered_mechanisms.length < 8) {
  fail("Must declare at least 8 observed triggered mechanisms for minimal neutral kernel");
}

for (const tm of project.triggered_mechanisms) {
  if (!tm.observable_condition || !tm.smallest_mechanism_added || tm.trigger_observed !== true || !tm.necessity_criterion) {
    fail(`Mechanism ${tm.smallest_mechanism_added} missing trigger or necessity criterion`);
  }
}

if (!project.artifact_contract?.context_manifest?.length || !project.artifact_contract?.attempt_cursor) {
  fail("Artifact contract must define context_manifest and attempt_cursor");
}

if (project.recovery_policy?.ambiguous_side_effect?.action !== "stop_retries_and_await_owner_inspection_receipt") {
  fail("Recovery policy must stop retries and await owner inspection receipt for ambiguous side effects");
}

if (!project.lifecycle?.kernel_deletion_rule) {
  fail("Lifecycle record must define kernel_deletion_rule");
}

pass("solution/harness-project.json validated successfully");

// 3. Check 6 deterministic prototype invariant paths
const kernelFeatures = [
  "content-addressed context manifest",
  "repository-visible attempt cursor",
  "closed artifact and receipt gates",
  "host capability adapter",
  "pending approval pointer",
  "idempotency and replay declaration",
  "normalized lifecycle and trace correlation",
  "version and digest pin gate",
];

const initial = () => ({
  phase: "not started",
  taskClass: "none",
  pins: false,
  requirements: [],
  ownersPlaced: false,
  baselineTested: false,
  baselineFailures: [],
  candidate: "unselected",
  features: [],
  artifactContract: false,
  ambiguousEffect: false,
  recoveryPracticed: false,
  evaluated: false,
  lifecycle: false,
  selfExplanation: false,
  fadedCase: false,
  transferCase: false,
  shadowState: false,
  duplicateEffect: false,
  pinDrift: false,
  runtimeRecursion: false,
  status: "learning",
  last: "No harness-authoring task has been presented.",
});

const copy = (val) => JSON.parse(JSON.stringify(val));
const requiresKernel = (state) => state.baselineFailures.length > 0;
const blockers = (state) =>
  [
    state.taskClass === "none" && "the meaningful harness task was not attempted",
    !state.pins && "guide, Method Contract, teaching-skill, and research digests are not pinned",
    !state.requirements.length && "observable outcome and failure tests are missing",
    !state.ownersPlaced && "owner boundaries are missing",
    !state.baselineTested && "the thin baseline was not tested",
    state.candidate === "unselected" && "no candidate verdict exists",
    requiresKernel(state) && state.features.length !== kernelFeatures.length && "one or more observed kernel triggers are unsatisfied",
    !requiresKernel(state) && state.features.length > 0 && "unneeded kernel mechanisms survived trimming",
    !state.artifactContract && "the pointer-only artifact contract is missing",
    requiresKernel(state) && !state.recoveryPracticed && "ambiguous-effect recovery was not practiced",
    !state.evaluated && "lifecycle fixtures were not evaluated",
    !state.lifecycle && "version, review, and deletion triggers are missing",
    !state.selfExplanation && "self-explanation prompts are unanswered",
    !state.fadedCase && "the faded case is unfinished",
    !state.transferCase && "the staged self-application transfer is unfinished",
    state.shadowState && "the harness copied owner state",
    state.duplicateEffect && "an ambiguous side effect was automatically replayed",
    state.pinDrift && "derived state no longer matches the pinned sources",
    state.runtimeRecursion && "the runtime invokes its active builder",
  ].filter(Boolean);

const advance = (state, action) => {
  const next = copy(state);
  const stop = (message) => {
    next.last = `Stopped: ${message}.`;
    return next;
  };
  switch (action) {
    case "reset":
      return initial();
    case "task":
      next.taskClass = "cross-session";
      next.phase = "meaningful task";
      return next;
    case "small-task":
      next.taskClass = "single-session";
      next.phase = "meaningful task";
      return next;
    case "pin":
      if (next.taskClass === "none") return stop("start with a harness task");
      next.pins = true;
      next.phase = "sources pinned";
      return next;
    case "requirements":
      if (!next.pins) return stop("pin the normative and research sources first");
      next.requirements = next.taskClass === "cross-session"
        ? ["cold start", "mid-run resume", "approval preservation", "no ambiguous replay", "artifact rejection", "pin rejection", "trace correlation"]
        : ["contract validation"];
      next.phase = "outcome tests";
      return next;
    case "owners":
      if (!next.requirements.length) return stop("define outcome tests before placing mechanisms");
      next.ownersPlaced = true;
      next.phase = "ownership boundary";
      return next;
    case "baseline":
      if (!next.ownersPlaced) return stop("place owner boundaries before testing candidates");
      next.baselineTested = true;
      next.baselineFailures = next.taskClass === "cross-session" ? ["mid-run resume", "ambiguous side effect"] : [];
      next.phase = "baseline measured";
      return next;
    case "select":
      if (!next.baselineTested) return stop("test the thin baseline before selecting a candidate");
      next.candidate = requiresKernel(next) ? "minimal neutral kernel" : "thin baseline";
      next.phase = "candidate selected";
      return next;
    case "triggers":
      if (next.candidate === "unselected") return stop("select a candidate after the baseline result");
      next.features = requiresKernel(next) ? [...kernelFeatures] : [];
      next.phase = "triggered mechanisms";
      return next;
    case "contract":
      if (next.candidate === "unselected") return stop("select the smallest candidate first");
      if (requiresKernel(next) && next.features.length !== kernelFeatures.length) return stop("apply the observed mechanism triggers first");
      next.artifactContract = true;
      next.phase = "artifact contract";
      return next;
    case "inject":
      if (!next.artifactContract || !requiresKernel(next)) return stop("the cross-session kernel contract must exist before failure injection");
      next.ambiguousEffect = true;
      next.phase = "waiting for inspection";
      return next;
    case "recover":
      if (!next.ambiguousEffect) return stop("recovery requires an observed ambiguous effect");
      next.ambiguousEffect = false;
      next.recoveryPracticed = true;
      next.phase = "recovered";
      return next;
    case "evaluate":
      if (!next.artifactContract) return stop("write the artifact contract before evaluating it");
      if (requiresKernel(next) && !next.recoveryPracticed) return stop("practice ambiguous-effect recovery before the evaluation pass");
      next.evaluated = true;
      next.phase = "evaluated";
      return next;
    case "lifecycle":
      if (!next.evaluated) return stop("evaluate repository outcomes before locking lifecycle guidance");
      next.lifecycle = true;
      next.phase = "lifecycle recorded";
      return next;
    case "explain":
      if (!next.lifecycle) return stop("complete the worked design before self-explanation");
      next.selfExplanation = true;
      next.phase = "explained";
      return next;
    case "fade":
      if (!next.selfExplanation) return stop("explain the complete example before fading support");
      next.fadedCase = true;
      next.phase = "faded practice";
      return next;
    case "transfer":
      if (!next.fadedCase) return stop("complete the faded case first");
      next.transferCase = true;
      next.phase = "staged transfer";
      return next;
    case "shadow":
      next.shadowState = true;
      return next;
    case "replay":
      next.duplicateEffect = true;
      next.ambiguousEffect = false;
      return next;
    case "drift":
      next.pinDrift = true;
      next.pins = false;
      return next;
    case "recurse":
      next.runtimeRecursion = true;
      return next;
    case "gate": {
      const reasons = blockers(next);
      next.status = reasons.length ? "rejected" : next.candidate === "thin baseline" ? "trimmed" : "independent";
      next.phase = reasons.length ? "blocked" : "complete";
      return next;
    }
    default:
      return stop(`unknown action ${action}`);
  }
};

const fullActions = ["task", "pin", "requirements", "owners", "baseline", "select", "triggers", "contract", "inject", "recover", "evaluate", "lifecycle", "explain", "fade", "transfer"];
const thinActions = ["small-task", "pin", "requirements", "owners", "baseline", "select", "triggers", "contract", "evaluate", "lifecycle", "explain", "fade", "transfer"];

const run = (actions) => actions.reduce(advance, initial());
const complete = advance(run(fullActions), "gate");
const thin = advance(run(thinActions), "gate");
const shadow = advance(run([...fullActions, "shadow"]), "gate");
const replay = advance(run([...fullActions.slice(0, 9), "replay", ...fullActions.slice(10)]), "gate");
const drift = advance(run([...fullActions, "drift"]), "gate");
const recursive = advance(run([...fullActions, "recurse"]), "gate");

if (complete.status !== "independent") fail(`Complete path status: expected 'independent', got '${complete.status}'`);
if (thin.status !== "trimmed") fail(`Thin path status: expected 'trimmed', got '${thin.status}'`);
if (shadow.status !== "rejected") fail(`Shadow state status: expected 'rejected', got '${shadow.status}'`);
if (replay.status !== "rejected") fail(`Replay status: expected 'rejected', got '${replay.status}'`);
if (drift.status !== "rejected") fail(`Pin drift status: expected 'rejected', got '${drift.status}'`);
if (recursive.status !== "rejected") fail(`Recursion status: expected 'rejected', got '${recursive.status}'`);

pass("6 deterministic prototype invariant paths passed");
console.log("\x1b[32mAll verification checks passed!\x1b[0m");
