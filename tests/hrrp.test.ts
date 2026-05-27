import { describe, it, expect } from "vitest";
import { num, median, round } from "../src/lib/hrrp/normalize";
import { benchmarkHospital, statePenaltyCount } from "../src/lib/hrrp/benchmark";
import type { ConditionKey, ConditionMeasure, HospitalRecord } from "../src/lib/hrrp/types";

describe("normalize", () => {
  it("turns CMS suppression sentinels into null, never NaN", () => {
    for (const s of ["N/A", "n/a", "Too Few to Report", "", "Not Available", "NA"]) {
      expect(num(s)).toBeNull();
    }
    expect(num("1.23")).toBe(1.23);
    expect(num("1,234")).toBe(1234);
    expect(num(null)).toBeNull();
    expect(num("garbage")).toBeNull();
  });

  it("median handles even/odd/empty", () => {
    expect(median([])).toBeNull();
    expect(median([1, 3])).toBe(2);
    expect(median([5, 1, 3])).toBe(3);
  });

  it("round trims float noise", () => {
    expect(round(1.23 - 1.045)).toBe(0.185);
  });
});

function m(condition: ConditionKey, err: number | null): ConditionMeasure {
  return {
    condition,
    excessRatio: err,
    predicted: err === null ? null : 20,
    expected: err === null ? null : 19,
    discharges: err === null ? null : 300,
    readmissions: err === null ? null : 60,
    suppressed: err === null,
  };
}

function hosp(id: string, name: string, hf: number | null): HospitalRecord {
  return {
    id,
    name,
    state: "XX",
    county: "TEST",
    hospitalType: "Acute Care Hospitals",
    measures: { HF: m("HF", hf) },
  };
}

describe("benchmarkHospital", () => {
  const shard: HospitalRecord[] = [
    hosp("1", "Best Hospital", 0.9),
    hosp("2", "Median Hospital", 1.0),
    hosp("3", "Worst Hospital", 1.3),
    hosp("4", "Suppressed Hospital", null),
  ];

  it("ranks against non-suppressed state peers", () => {
    const r = benchmarkHospital("3", shard);
    const hf = r.conditions.find((c) => c.condition === "HF")!;
    expect(hf.excessRatio).toBe(1.3);
    expect(hf.penalized).toBe(true);
    expect(hf.peerCount).toBe(3); // suppressed hospital excluded
    expect(hf.rank).toBe(3); // worst of the three reported
    expect(hf.stateBest).toBe(0.9);
    expect(hf.stateMedian).toBe(1.0);
    expect(hf.gapToMedian).toBe(0.3);
  });

  it("best hospital ranks first and is not penalized", () => {
    const hf = benchmarkHospital("1", shard).conditions.find((c) => c.condition === "HF")!;
    expect(hf.rank).toBe(1);
    expect(hf.penalized).toBe(false);
  });

  it("suppressed hospital reports null, not a fabricated rank", () => {
    const r = benchmarkHospital("4", shard);
    const hf = r.conditions.find((c) => c.condition === "HF")!;
    expect(hf.suppressed).toBe(true);
    expect(hf.rank).toBeNull();
    expect(hf.penalized).toBeNull();
    expect(r.reportedCount).toBe(0);
  });

  it("identifies the worst penalized condition by gap to median", () => {
    const r = benchmarkHospital("3", shard);
    expect(r.worst?.condition).toBe("HF");
    expect(r.penalizedCount).toBe(1);
  });

  it("throws for an unknown hospital", () => {
    expect(() => benchmarkHospital("999", shard)).toThrow();
  });
});

describe("statePenaltyCount", () => {
  it("counts penalized hospitals over reported ones", () => {
    const shard: HospitalRecord[] = [
      hosp("1", "A", 0.9),
      hosp("2", "B", 1.1),
      hosp("3", "C", 1.2),
      hosp("4", "D", null),
    ];
    expect(statePenaltyCount(shard, "HF")).toEqual({ penalized: 2, reported: 3 });
  });
});
