// Shared contract for the Readmission Reality Check.
// Built on CMS Hospital Readmissions Reduction Program (HRRP, dataset
// 9n3s-kdb3) joined to CMS Hospital General Information (xubh-q36u).
// Reused by the web UI, the CLI, and any future MCP server.

export type ConditionKey = "HF" | "AMI" | "COPD" | "PN" | "CABG" | "HIP_KNEE";

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  HF: "Heart failure",
  AMI: "Heart attack (AMI)",
  COPD: "COPD",
  PN: "Pneumonia",
  CABG: "Bypass surgery (CABG)",
  HIP_KNEE: "Hip / knee replacement",
};

// CMS HRRP measure_name -> our key.
export const MEASURE_TO_CONDITION: Record<string, ConditionKey> = {
  "READM-30-HF-HRRP": "HF",
  "READM-30-AMI-HRRP": "AMI",
  "READM-30-COPD-HRRP": "COPD",
  "READM-30-PN-HRRP": "PN",
  "READM-30-CABG-HRRP": "CABG",
  "READM-30-HIP-KNEE-HRRP": "HIP_KNEE",
};

/** One condition's HRRP numbers for one hospital. null = CMS-suppressed. */
export interface ConditionMeasure {
  condition: ConditionKey;
  excessRatio: number | null;
  predicted: number | null;
  expected: number | null;
  discharges: number | null;
  readmissions: number | null;
  suppressed: boolean;
}

/** A hospital as stored in a per-state shard. */
export interface HospitalRecord {
  id: string; // CCN (facility_id)
  name: string;
  state: string;
  county: string | null;
  hospitalType: string | null;
  measures: Partial<Record<ConditionKey, ConditionMeasure>>;
}

/** A hospital benchmarked against its state peers, for one condition. */
export interface ConditionBenchmark {
  condition: ConditionKey;
  label: string;
  excessRatio: number | null;
  /** ERR > 1.0 = worse than expected = penalty territory. null if suppressed. */
  penalized: boolean | null;
  discharges: number | null;
  readmissions: number | null;
  /** State peer stats over hospitals with a non-suppressed ratio. */
  stateMedian: number | null;
  stateBest: number | null;
  rank: number | null; // 1 = best (lowest ratio) in state
  peerCount: number;
  gapToMedian: number | null; // excessRatio - stateMedian
  suppressed: boolean;
}

export interface BenchmarkResult {
  hospital: { id: string; name: string; state: string; county: string | null };
  conditions: ConditionBenchmark[];
  penalizedCount: number;
  reportedCount: number;
  /** The condition where this hospital is worst relative to its state peers. */
  worst: ConditionBenchmark | null;
}

/** Lightweight picker index entry. */
export interface HospitalIndexEntry {
  id: string;
  name: string;
  state: string;
  county: string | null;
}

export interface SnapshotManifest {
  version: number;
  fetchedAt: string;
  hrrpPeriod: { start: string; end: string };
  sources: { hrrp: string; hospitals: string };
  states: string[];
  conditions: ConditionKey[];
  counts: { hospitals: number; hrrpRows: number; suppressedRatios: number };
}
