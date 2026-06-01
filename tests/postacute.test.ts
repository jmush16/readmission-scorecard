import { describe, it, expect } from "vitest";
import {
  aggregateSnf,
  aggregateHh,
  postAcuteForCounty,
  summarizePostAcute,
  type SnfFacilityRaw,
  type HhAgencyRaw,
} from "../src/lib/hrrp/postacute";
import type { PostAcuteShard, SnfAggregate } from "../src/lib/hrrp/types";

const WORSE = "Worse than the National Rate";
const BETTER = "Better than the National Rate";
const SAME = "No Different than the National Rate";
const NA = "Not Available";

function snf(name: string, county: string, ppr: number | null, verdict: string | null, dtc: number | null = 50): SnfFacilityRaw {
  return { name, county, ppr, pprVerdict: verdict, dtc };
}

describe("aggregateSnf", () => {
  it("computes medians over non-suppressed rates only and counts CMS 'worse' verdicts", () => {
    const a = aggregateSnf([
      snf("A", "COOK", 10, SAME),
      snf("B", "COOK", 20, WORSE),
      snf("C", "COOK", 30, WORSE),
      snf("D", "COOK", null, NA), // fully suppressed — excluded from median + verdictCount
    ]);
    expect(a.count).toBe(4); // facilities CMS tracks here
    expect(a.reporting).toBe(3); // facilities with a usable rate
    expect(a.pprMedian).toBe(20); // median of [10,20,30], NOT dragged by the null
    expect(a.worseCount).toBe(2);
    expect(a.verdictCount).toBe(3); // "Not Available" excluded
  });

  it("topWorst lists the highest rehospitalization rates first, capped at 3", () => {
    const a = aggregateSnf([
      snf("low", "X", 5, BETTER),
      snf("high", "X", 40, WORSE),
      snf("mid", "X", 22, SAME),
      snf("mid2", "X", 18, SAME),
    ]);
    expect(a.topWorst.map((f) => f.name)).toEqual(["high", "mid", "mid2"]);
    expect(a.topWorst[0].rate).toBe(40);
    expect(a.topWorst[0].worse).toBe(true);
  });

  it("returns null medians (never NaN) when nothing reports", () => {
    const a = aggregateSnf([snf("A", "X", null, NA), snf("B", "X", null, null)]);
    expect(a.reporting).toBe(0);
    expect(a.pprMedian).toBeNull();
    expect(a.verdictCount).toBe(0);
    expect(a.worseCount).toBe(0);
  });
});

describe("aggregateHh", () => {
  it("aggregates PPH/PPR/DTC and counts worse-than-national agencies", () => {
    const rows: HhAgencyRaw[] = [
      { pph: 8, pphVerdict: BETTER, ppr: 3, dtc: 80 },
      { pph: 12, pphVerdict: WORSE, ppr: 5, dtc: 70 },
      { pph: null, pphVerdict: NA, ppr: null, dtc: null },
    ];
    const a = aggregateHh(rows);
    expect(a.count).toBe(3);
    expect(a.reporting).toBe(2);
    expect(a.pphMedian).toBe(10);
    expect(a.worseCount).toBe(1);
    expect(a.verdictCount).toBe(2);
  });
});

describe("postAcuteForCounty", () => {
  const cookSnf: SnfAggregate = aggregateSnf([
    snf("A", "COOK", 10, SAME),
    snf("B", "COOK", 20, WORSE),
  ]);
  const sparseSnf: SnfAggregate = aggregateSnf([snf("Solo", "RURAL", 14, SAME)]);
  const stateSnf: SnfAggregate = aggregateSnf([
    snf("S1", "COOK", 10, SAME),
    snf("S2", "RURAL", 14, SAME),
    snf("S3", "OTHER", 25, WORSE),
  ]);
  const shard: PostAcuteShard = {
    national: { snfPprMedian: 15, hhPph: 10.8, hhPpr: 4.1, hhDtc: 77.7 },
    state: { snf: stateSnf, hh: aggregateHh([{ pph: 11, pphVerdict: "Worse Than National Rate", ppr: 4, dtc: 76 }]) },
    counties: { COOK: { snf: cookSnf }, RURAL: { snf: sparseSnf } },
  };

  it("uses the county aggregate when it has enough reporting SNFs", () => {
    const r = postAcuteForCounty(shard, "Cook");
    expect(r.usedState).toBe(false);
    expect(r.county).toBe("COOK");
    expect(r.snf?.reporting).toBe(2);
    expect(r.snf?.pprMedian).toBe(15); // median of [10,20], county-scoped
  });

  it("falls back to the state roll-up for a too-sparse county", () => {
    const r = postAcuteForCounty(shard, "Rural");
    expect(r.usedState).toBe(true);
    expect(r.snf?.reporting).toBe(3); // the state aggregate
  });

  it("falls back to state for an unmatched county", () => {
    const r = postAcuteForCounty(shard, "Nonexistent");
    expect(r.usedState).toBe(true);
    expect(r.snf).toBe(stateSnf);
  });

  it("falls back to state for a null county and always returns state-scoped HH", () => {
    const r = postAcuteForCounty(shard, null);
    expect(r.usedState).toBe(true);
    expect(r.hh?.worseCount).toBe(1); // HH verdict casing "Worse Than National Rate" handled
    expect(r.national.hhPph).toBe(10.8);
  });
});

describe("summarizePostAcute", () => {
  it("builds an honest sentence and labels the scope", () => {
    const r = postAcuteForCounty(
      {
        national: { snfPprMedian: 15, hhPph: 10.8, hhPpr: 4.1, hhDtc: 77.7 },
        state: { snf: null, hh: aggregateHh([{ pph: 13, pphVerdict: "Worse Than National Rate", ppr: 4, dtc: 70 }]) },
        counties: { COOK: { snf: aggregateSnf([snf("A", "COOK", 10, "Worse than the National Rate"), snf("B", "COOK", 22, "Worse than the National Rate")]) } },
      },
      "Cook",
    );
    const s = summarizePostAcute(r);
    expect(s).toMatch(/2 of 2 nearby SNFs \(in this county\)/);
    expect(s).toMatch(/13% of patients to a potentially-preventable hospitalization/);
    expect(s).toContain("vs 10.8% nationally");
  });

  it("returns empty string when there is no usable signal (never invents one)", () => {
    const r = postAcuteForCounty(
      { national: { snfPprMedian: null, hhPph: null, hhPpr: null, hhDtc: null }, state: { snf: null, hh: null }, counties: {} },
      "Anywhere",
    );
    expect(summarizePostAcute(r)).toBe("");
  });
});
