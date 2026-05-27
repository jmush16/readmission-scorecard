import { describe, it, expect } from "vitest";
import type { AuditFacts } from "../src/types";
import { runAudit, clamp } from "../src/lib/scoring";
import { defaultFactSelections, DISCHARGES_DEFAULT } from "../src/data/questions";
import { auditPackage } from "../src/lib/exports";

function facts(overrides: Partial<AuditFacts> = {}): AuditFacts {
  return {
    role: "pop",
    county: "allegheny",
    monthlyDischarges: DISCHARGES_DEFAULT,
    ...defaultFactSelections(),
    ...overrides,
  };
}

describe("clamp", () => {
  it("bounds values", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe("runAudit", () => {
  it("produces a score in 0..100 with six dimensions", () => {
    const r = runAudit(facts());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.dimensions).toHaveLength(6);
  });

  it("weakest is the lowest-scoring dimension", () => {
    const r = runAudit(facts());
    const min = Math.min(...r.dimensions.map((d) => d.score));
    expect(r.weakest.score).toBe(min);
    expect(r.weakest.score).toBeLessThanOrEqual(r.secondWeakest.score);
  });

  it("a strong workflow scores higher than a weak one", () => {
    const weak = runAudit(
      facts({ visibility: 20, followup: 22, meds: 20, teachback: 24, owner: 24, closure: 18, capacity: 25 }),
    );
    const strong = runAudit(
      facts({ visibility: 92, followup: 86, meds: 90, teachback: 92, owner: 92, closure: 90, capacity: 88 }),
    );
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(weak.status.label).toBe("High continuity risk");
    expect(strong.status.label).toBe("Strong baseline");
  });

  it("low medication access surfaces as the medication_access break", () => {
    const r = runAudit(
      facts({ meds: 20, visibility: 90, followup: 86, teachback: 92, owner: 92, closure: 90, capacity: 88 }),
    );
    expect(r.weakest.key).toBe("medication_access");
    expect(r.firstBreak).toMatch(/medication access/i);
  });

  it("high discharge volume strains capacity", () => {
    const low = runAudit(facts({ monthlyDischarges: 100 }));
    const high = runAudit(facts({ monthlyDischarges: 1200 }));
    const capLow = low.dimensions.find((d) => d.key === "capacity")!.score;
    const capHigh = high.dimensions.find((d) => d.key === "capacity")!.score;
    expect(capHigh).toBeLessThan(capLow);
  });

  it("frontline role defaults to the operator audience; others to risk_owner", () => {
    expect(runAudit(facts({ role: "operator" })).audience).toBe("operator");
    expect(runAudit(facts({ role: "aco" })).audience).toBe("risk_owner");
    expect(runAudit(facts({ role: "medecon" })).audience).toBe("risk_owner");
  });

  it("the 14-day failure map always has five entries", () => {
    expect(runAudit(facts()).failureMap).toHaveLength(5);
  });
});

describe("auditPackage export", () => {
  it("is PHI-free and carries the contract fields", () => {
    const pkg = auditPackage(runAudit(facts()));
    expect(pkg.tool).toMatch(/Heart Failure/);
    expect(pkg.readiness_score).toBeTypeOf("number");
    expect(pkg.dimensions).toHaveLength(6);
    expect(pkg.pilot_data_request.length).toBeGreaterThan(0);
    expect(pkg.caveats.length).toBeGreaterThan(0);
    // No PHI-ish keys leak into inputs.
    const keys = Object.keys(pkg.inputs).join(" ");
    expect(keys).not.toMatch(/name|mrn|dob|ssn/i);
  });
});
