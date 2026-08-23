import type { Node } from "../../core/schemas/nodes.js";

export type UncertaintySignalKind =
  | "ambiguous_requirements"
  | "unknown_fact"
  | "assumption"
  | "competing_candidates"
  | "contradiction"
  | "risky_transition";

export interface PreflightSignal {
  kind: UncertaintySignalKind;
  evidence: string;
}

export type AriadneOperation =
  | "10-frame"
  | "20-diagnose"
  | "30-transform"
  | "40-explore"
  | "50-knowledge"
  | "60-dependencies"
  | "70-dynamics"
  | "80-value"
  | "90-validate";

const SIGNAL_PATTERNS: ReadonlyArray<{
  kind: UncertaintySignalKind;
  pattern: RegExp;
}> = [
  {
    kind: "ambiguous_requirements",
    pattern:
      /\b(?:unclear|ambiguous|vague|underspecified|it depends|or something|somehow|not sure what|which one should)\b/iu,
  },
  {
    kind: "unknown_fact",
    pattern:
      /\b(?:don't know|do not know|unknown fact|no idea|need to find out|unverified|we never measured|how (?:do|does|can) we know)\b/iu,
  },
  {
    kind: "assumption",
    pattern:
      /\b(?:assume|assumes|assuming|assumption|presumably|probably works|should be fine|i think that)\b/iu,
  },
  {
    kind: "competing_candidates",
    pattern:
      /\b(?:option a|option b|candidate|alternative|versus|\bvs\.?\b|trade[- ]?off between|two approaches|multiple ways|either .* or)\b/iu,
  },
  {
    kind: "contradiction",
    pattern:
      /\b(?:contradic\w+|conflicts? with|but the docs say|inconsistent|both say|disagree[sd]?|paradox)\b/iu,
  },
  {
    kind: "risky_transition",
    pattern:
      /\b(?:migration|migrate|cutover|cut over|deprecat\w+|breaking change|risky|dangerous to change|cannot roll back|irreversible|production data)\b/iu,
  },
];

// Routine known-answer requests stay outside the deep uncertainty route.
export function isRoutineKnownAnswer(text: string): boolean {
  const routine =
    /^(?:what(?:'s| is| are)?|who(?:'s| is)?|when|where|how many|how much)\b[^?!]*[?.]?\s*$/iu;
  const hasUncertaintyMarker = SIGNAL_PATTERNS.some(({ pattern }) => pattern.test(text));
  return routine.test(text.trim()) && !hasUncertaintyMarker;
}

export function detectUncertaintySignals(text: string): PreflightSignal[] {
  if (isRoutineKnownAnswer(text)) return [];
  const signals: PreflightSignal[] = [];
  for (const { kind, pattern } of SIGNAL_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      signals.push({ kind, evidence: match[0].toLowerCase() });
    }
  }
  return signals;
}

// Branch priority mirrors the SKILL router order; the first matching branch
// selects the next operation. Grilling skills are never invoked here.
const OPERATION_BY_KIND: Record<UncertaintySignalKind, AriadneOperation> = {
  ambiguous_requirements: "10-frame",
  contradiction: "20-diagnose",
  competing_candidates: "40-explore",
  unknown_fact: "50-knowledge",
  assumption: "50-knowledge",
  risky_transition: "90-validate",
};

const PRIORITY: readonly UncertaintySignalKind[] = [
  "ambiguous_requirements",
  "contradiction",
  "competing_candidates",
  "unknown_fact",
  "assumption",
  "risky_transition",
];

export function selectNextOperation(signals: PreflightSignal[]): AriadneOperation | undefined {
  for (const kind of PRIORITY) {
    if (signals.some((signal) => signal.kind === kind)) {
      return OPERATION_BY_KIND[kind];
    }
  }
  return undefined;
}

export type CardKind =
  | "FRAME"
  | "UNK"
  | "ASM"
  | "CTR"
  | "HYP"
  | "CAN"
  | "EVDREQ"
  | "OBS"
  | "TRANS";

export interface PreflightCard {
  id: string;
  kind: CardKind;
  statement: string;
  provenance: "user-stated" | "derived";
  unresolvedRisks: string[];
  sourcePointer: string;
}

export interface PreflightSubstrate {
  routed: boolean;
  operation?: AriadneOperation;
  cards: PreflightCard[];
  frontier: string[];
  openRisks: string[];
  graphPointer: string;
}

const KIND_FOR_SIGNAL: Record<UncertaintySignalKind, CardKind> = {
  ambiguous_requirements: "FRAME",
  unknown_fact: "UNK",
  assumption: "ASM",
  competing_candidates: "CAN",
  contradiction: "CTR",
  risky_transition: "TRANS",
};

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 32) || "card";

export function buildSubstrate(
  text: string,
  options: { graphPointer?: string } = {},
): PreflightSubstrate {
  const signals = detectUncertaintySignals(text);
  const graphPointer = options.graphPointer ?? ".ariadne/GRAPH.jsonl";
  if (signals.length === 0) {
    return { routed: false, cards: [], frontier: [], openRisks: [], graphPointer };
  }

  const cards: PreflightCard[] = [];
  const addCard = (kind: CardKind, statement: string, risks: string[] = []): void => {
    cards.push({
      id: `${kind}-${slug(statement)}-${cards.length + 1}`,
      kind,
      statement,
      provenance: "user-stated",
      unresolvedRisks: risks,
      sourcePointer: graphPointer,
    });
  };

  for (const signal of signals) {
    // Risky transitions are recorded as observations here: authoring a formal
    // TRANS card requires mechanism/predicate fields owned by 90-validate.
    if (signal.kind === "risky_transition") {
      addCard("OBS", text.trim(), ["transition may be irreversible without owner approval"]);
      continue;
    }
    addCard(KIND_FOR_SIGNAL[signal.kind], text.trim());
    // Unknown facts always demand an explicit evidence request.
    if (signal.kind === "unknown_fact") {
      addCard("EVDREQ", `Discriminating evidence for: ${text.trim()}`);
    }
  }

  return {
    routed: true,
    operation: selectNextOperation(signals),
    cards,
    frontier: cards.filter((card) => card.kind === "UNK").map((card) => card.id),
    openRisks: cards.flatMap((card) => card.unresolvedRisks),
    graphPointer,
  };
}

// Convenience: shape the substrate cards as persistable node payloads.
export function substrateCardsAsNodes(cards: PreflightCard[]): Node[] {
  return cards.map((card) => ({
    id: card.id,
    type: card.kind === "TRANS" ? ("TRANS" as Node["type"]) : card.kind,
    statement: card.statement,
    provenance_type: card.provenance === "user-stated" ? "PROPOSED" : "DERIVED",
    status: "active",
    unresolved_risks: card.unresolvedRisks,
  })) as Node[];
}
