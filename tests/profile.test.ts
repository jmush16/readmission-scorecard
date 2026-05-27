import { describe, it, expect } from "vitest";
import { buildProfile } from "../src/lib/hrrp/profile";
import type { ConditionKey, HospitalRecord, RateMeasure } from "../src/lib/hrrp/types";

function rate(id: string, score: number | null, denominator: number | null, cmp: string, end = "06/30/2024"): RateMeasure {
  return {
    id,
    score,
    comparedToNational: cmp,
    denominator,
    patients: null,
    returned: null,
    period: { start: "07/01/2023", end },
    footnote: null,
  };
}

function hrrpHF(err: number): Record<ConditionKey, never> | Partial<Record<ConditionKey, any>> {
  return { HF: { condition: "HF", excessRatio: err, predicted: 22, expected: 20, discharges: 685, readmissions: 166, suppressed: false } };
}

const tierA: HospitalRecord = {
  id: "A", name: "Full Data Hospital", state: "MA", county: "MIDDLESEX", hospitalType: "Acute Care Hospitals",
  measures: hrrpHF(1.23) as any,
  overall: { rating: 3, ownership: "Voluntary non-profit - Private", emergencyServices: true, readm: null, mortality: null, safety: null },
  rates: {
    Hybrid_HWR: rate("Hybrid_HWR", 16.8, 3465, "Worse Than the National Rate"),
    READM_30_HF: rate("READM_30_HF", 24.2, 685, "Worse Than the National Rate"),
    OP_35_ED: rate("OP_35_ED", 5.1, 200, "No Different Than the National Rate", "12/31/2024"),
  },
};

const tierB: HospitalRecord = {
  id: "B", name: "Critical Access Hospital", state: "KS", county: "ALLEN", hospitalType: "Critical Access Hospitals",
  measures: {},
  overall: { rating: 4, ownership: "Government - Local", emergencyServices: true, readm: null, mortality: null, safety: null },
  rates: { Hybrid_HWR: rate("Hybrid_HWR", 14.6, 900, "No Different Than the National Rate") },
};

const tierC: HospitalRecord = {
  id: "C", name: "Tiny Specialty Hospital", state: "KS", county: null, hospitalType: "Critical Access Hospitals",
  measures: {},
  overall: { rating: null, ownership: "Physician", emergencyServices: false, readm: null, mortality: null, safety: null },
  rates: {},
};

describe("buildProfile — tiers + recency", () => {
  it("Tier A: full HRRP + rates → rate headline, derived burden, audit block", () => {
    const p = buildProfile("A", [tierA]);
    expect(p.tier).toBe("full");
    expect(p.headline.kind).toBe("rate");
    expect(p.headline.label).toMatch(/Hospital-wide/);
    expect(p.headline.value).toBe("16.8%");
    expect(p.headline.worse).toBe(true);
    // burden derived from rate% x cohort: 16.8% of 3465 ≈ 582
    expect(p.burden?.returned).toBe(582);
    expect(p.benchmark.conditions.find((c) => c.condition === "HF")?.excessRatio).toBe(1.23);
  });

  it("Tier A recency ladder puts the 2024 OP measure first", () => {
    const p = buildProfile("A", [tierA]);
    expect(p.recency[0].id).toBe("OP_35_ED"); // end 12/31/2024 is freshest
    expect(p.recency.every((r) => r.asOf.length > 0)).toBe(true);
  });

  it("Tier B: HRRP suppressed but fresh rate → partial, no dead-end", () => {
    const p = buildProfile("B", [tierB]);
    expect(p.tier).toBe("partial");
    expect(p.headline.kind).toBe("rate");
    expect(p.headline.value).toBe("14.6%");
    expect(p.recency.length).toBeGreaterThan(0);
  });

  it("Tier C: no rates, no rating → descriptor headline, still not empty", () => {
    const p = buildProfile("C", [tierC]);
    expect(p.tier).toBe("backbone");
    expect(p.headline.kind).toBe("descriptor");
    expect(p.headline.label).toMatch(/Critical Access Hospital/);
    expect(p.burden).toBeNull();
  });

  it("rating headline when a rated hospital has no rate measures", () => {
    const rated: HospitalRecord = { ...tierC, id: "D", rates: {}, overall: { ...tierC.overall!, rating: 5 } };
    const p = buildProfile("D", [rated]);
    expect(p.headline.kind).toBe("rating");
    expect(p.headline.value).toMatch(/5 of 5/);
  });
});
