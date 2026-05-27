import type {
  BenchmarkResult,
  ConditionBenchmark,
  ConditionKey,
  HospitalRecord,
} from "./types";
import { CONDITION_LABELS } from "./types";
import { median, round } from "./normalize";

const CONDITION_ORDER: ConditionKey[] = ["HF", "COPD", "PN", "AMI", "HIP_KNEE", "CABG"];

/**
 * Benchmark one hospital against every other hospital in its state, per
 * condition. Pure: the same state shard in always yields the same result.
 * All peer statistics are computed over non-suppressed ratios only.
 */
export function benchmarkHospital(
  hospitalId: string,
  stateHospitals: HospitalRecord[],
): BenchmarkResult {
  const hospital = stateHospitals.find((h) => h.id === hospitalId);
  if (!hospital) {
    throw new Error(`Hospital ${hospitalId} not found in state shard`);
  }

  const conditions: ConditionBenchmark[] = CONDITION_ORDER.map((condition) => {
    const mine = hospital.measures[condition];

    // Peer ratios across the state for this condition (non-suppressed only).
    const peerRatios = stateHospitals
      .map((h) => h.measures[condition]?.excessRatio)
      .filter((r): r is number => typeof r === "number");

    const stateMedian = median(peerRatios);
    const stateBest = peerRatios.length ? Math.min(...peerRatios) : null;

    const err = mine?.excessRatio ?? null;
    const suppressed = !mine || mine.suppressed || err === null;

    let rank: number | null = null;
    if (err !== null) {
      // 1 = lowest ratio (best). Rank among non-suppressed peers.
      rank = peerRatios.filter((r) => r < err).length + 1;
    }

    return {
      condition,
      label: CONDITION_LABELS[condition],
      excessRatio: err,
      penalized: err === null ? null : err > 1,
      discharges: mine?.discharges ?? null,
      readmissions: mine?.readmissions ?? null,
      stateMedian: stateMedian === null ? null : round(stateMedian),
      stateBest: stateBest === null ? null : round(stateBest),
      rank,
      peerCount: peerRatios.length,
      gapToMedian: err !== null && stateMedian !== null ? round(err - stateMedian) : null,
      suppressed,
    };
  });

  const reported = conditions.filter((c) => !c.suppressed);
  const penalizedCount = reported.filter((c) => c.penalized).length;

  // Worst = penalized condition with the largest gap above the state median.
  const worst =
    reported
      .filter((c) => c.penalized && c.gapToMedian !== null)
      .sort((a, b) => (b.gapToMedian ?? 0) - (a.gapToMedian ?? 0))[0] ?? null;

  return {
    hospital: {
      id: hospital.id,
      name: hospital.name,
      state: hospital.state,
      county: hospital.county,
    },
    conditions,
    penalizedCount,
    reportedCount: reported.length,
    worst,
  };
}

/** How many hospitals in the state are penalized on a given condition. */
export function statePenaltyCount(
  stateHospitals: HospitalRecord[],
  condition: ConditionKey,
): { penalized: number; reported: number } {
  let penalized = 0;
  let reported = 0;
  for (const h of stateHospitals) {
    const err = h.measures[condition]?.excessRatio;
    if (typeof err === "number") {
      reported += 1;
      if (err > 1) penalized += 1;
    }
  }
  return { penalized, reported };
}
