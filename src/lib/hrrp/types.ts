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

// ----- Recency + coverage layer (632h-zaca + xubh-q36u) -----

/** A point-in-time CMS rate measure, each with its own measurement period. */
export interface RateMeasure {
  id: string; // e.g. "Hybrid_HWR", "READM_30_HF"
  score: number | null; // percent rate; null = CMS-suppressed
  comparedToNational: string | null; // CMS's own verdict string
  denominator: number | null;
  patients: number | null;
  returned: number | null; // number_of_patients_returned — a factual count
  period: { start: string; end: string };
  footnote: string | null;
}

export interface GroupRollup {
  measureCount: number | null;
  better: number | null;
  noDifferent: number | null;
  worse: number | null;
}

/** Care Compare overall summary, from xubh-q36u. Exists for ~all hospitals. */
export interface OverallProfile {
  rating: number | null; // 1..5; null if "Not Available"
  ownership: string | null;
  emergencyServices: boolean | null;
  readm: GroupRollup | null;
  mortality: GroupRollup | null;
  safety: GroupRollup | null;
}

/** A hospital as stored in a per-state shard. */
export interface HospitalRecord {
  id: string; // CCN (facility_id)
  name: string;
  state: string;
  county: string | null;
  hospitalType: string | null;
  measures: Partial<Record<ConditionKey, ConditionMeasure>>; // HRRP
  overall?: OverallProfile; // xubh-q36u
  rates?: Record<string, RateMeasure>; // 632h-zaca, keyed by measure id
}

export type CoverageTier = "full" | "partial" | "backbone";

/** A single line in the recency ladder, already resolved for display. */
export interface RecencyItem {
  id: string;
  label: string;
  value: string; // formatted (e.g. "24.2%")
  comparedToNational: string | null;
  asOf: string; // "Jul 2023 – Jun 2024"
  worse: boolean | null;
}

/** The full, tier-aware readout the UI and CLI render. */
export interface HospitalProfile {
  hospital: { id: string; name: string; state: string; county: string | null; type: string | null };
  tier: CoverageTier;
  headline: {
    kind: "rate" | "rating" | "descriptor";
    label: string;
    value: string;
    asOf: string | null;
    worse: boolean | null;
    comparedToNational: string | null;
  };
  /** Factual "N patients came back within 30 days" line, if we have it. */
  burden: { returned: number; denominator: number | null; label: string; asOf: string } | null;
  recency: RecencyItem[]; // freshest first
  benchmark: BenchmarkResult; // the HRRP audit block (lagged 2021–24)
  rating: number | null;
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
  sources: { hrrp: string; hospitals: string; unplanned: string };
  states: string[];
  conditions: ConditionKey[];
  /** Measurement period per rate measure id (e.g. Hybrid_HWR is fresher). */
  measurePeriods: Record<string, { start: string; end: string }>;
  counts: { hospitals: number; withRates: number; suppressedRatios: number };
}

/** Display labels for the rate measures we keep. */
export const RATE_LABELS: Record<string, string> = {
  Hybrid_HWR: "Hospital-wide readmissions",
  READM_30_HF: "Heart-failure readmissions",
  READM_30_AMI: "Heart-attack readmissions",
  READM_30_COPD: "COPD readmissions",
  READM_30_PN: "Pneumonia readmissions",
  READM_30_HIP_KNEE: "Hip/knee readmissions",
  READM_30_CABG: "Bypass (CABG) readmissions",
  OP_35_ADM: "Post-chemo admissions (outpatient)",
  OP_35_ED: "Post-chemo ED visits (outpatient)",
};

/** Measures we keep in the snapshot, in display/priority order. */
export const RATE_MEASURE_IDS = Object.keys(RATE_LABELS);
