import {
  meetProvenance,
  PROVENANCE_ORDER,
  type ProvenanceType,
} from "../core/types/provenance.js";

export const UNRESOLVED_PREMISE = "UNRESOLVED_PREMISE" as const;
export type DerivationProvenance = ProvenanceType | typeof UNRESOLVED_PREMISE;
export type ProvenancePremise =
  | ProvenanceType
  | { provenance_type: ProvenanceType; [key: string]: unknown };

const isProvenance = (value: unknown): value is ProvenanceType =>
  typeof value === "string" &&
  (PROVENANCE_ORDER as readonly string[]).includes(value);

const premiseProvenance = (premise: ProvenancePremise): ProvenanceType => {
  const value = typeof premise === "string" ? premise : premise.provenance_type;
  if (!isProvenance(value)) {
    throw new TypeError(`Invalid premise provenance: ${String(value)}`);
  }
  return value;
};

export function computeDerivedProvenance(
  premises: readonly ProvenancePremise[],
): DerivationProvenance {
  if (premises.length === 0) return UNRESOLVED_PREMISE;

  const provenances = premises.map(premiseProvenance);
  if (provenances.includes("UNKNOWN")) return UNRESOLVED_PREMISE;
  if (provenances.includes("ASSUMED")) return "ASSUMED";

  if (
    provenances.every((provenance) =>
      ["DERIVED", "MEASURED", "FACT"].includes(provenance),
    )
  ) {
    return "DERIVED";
  }

  return meetProvenance(provenances);
}
