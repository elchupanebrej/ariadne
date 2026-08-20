import { PROVENANCE_TYPES, type ProvenanceType } from "./nodes.js";

export { PROVENANCE_TYPES } from "./nodes.js";
export type { ProvenanceType } from "./nodes.js";

export const PROVENANCE_ORDER = PROVENANCE_TYPES;

const PROVENANCE_RANK: Record<ProvenanceType, number> = {
  UNKNOWN: 0,
  ASSUMED: 1,
  PROPOSED: 2,
  DERIVED: 3,
  MEASURED: 4,
  FACT: 5,
  DECIDED: 6,
};

export function isMoreRigorous(
  candidate: ProvenanceType,
  baseline: ProvenanceType,
): boolean {
  return PROVENANCE_RANK[candidate] > PROVENANCE_RANK[baseline];
}

export function meetProvenance(
  provenances: readonly ProvenanceType[],
): ProvenanceType {
  return provenances.reduce<ProvenanceType>(
    (weakest, current) =>
      PROVENANCE_RANK[current] < PROVENANCE_RANK[weakest] ? current : weakest,
    "DECIDED",
  );
}
