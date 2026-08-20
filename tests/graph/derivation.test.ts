import { describe, expect, it } from "vitest";
import { computeDerivedProvenance } from "../../src/graph/derivation.js";

describe("computeDerivedProvenance", () => {
  it("returns an unresolved premise when any input is UNKNOWN", () => {
    expect(computeDerivedProvenance(["FACT", "UNKNOWN", "DECIDED"])).toBe(
      "UNRESOLVED_PREMISE",
    );
  });

  it("clamps any ASSUMED premise to ASSUMED", () => {
    expect(computeDerivedProvenance(["FACT", "ASSUMED", "DECIDED"])).toBe(
      "ASSUMED",
    );
  });

  it("derives only from DERIVED, MEASURED, and FACT premises", () => {
    expect(computeDerivedProvenance(["DERIVED", "MEASURED", "FACT"])).toBe(
      "DERIVED",
    );
    expect(computeDerivedProvenance(["DECIDED", "FACT"])).toBe("FACT");
    expect(computeDerivedProvenance(["DECIDED"])).toBe("DECIDED");
  });

  it("returns the weakest lower provenance when derivation is not justified", () => {
    expect(computeDerivedProvenance(["PROPOSED", "FACT"])).toBe("PROPOSED");
  });

  it("reads provenance from canonical nodes and rejects empty premises", () => {
    expect(
      computeDerivedProvenance([
        { id: "TASK-1", type: "TASK", provenance_type: "FACT", statement: "a" },
        { id: "TASK-2", type: "TASK", provenance_type: "MEASURED", statement: "b" },
      ]),
    ).toBe("DERIVED");
    expect(computeDerivedProvenance([])).toBe("UNRESOLVED_PREMISE");
  });
});
