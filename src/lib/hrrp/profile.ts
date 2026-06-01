import type {
  CoverageTier,
  HospitalProfile,
  HospitalRecord,
  RateMeasure,
  RecencyItem,
} from "./types";
import { RATE_LABELS } from "./types";
import { benchmarkHospital } from "./benchmark";
import { formatPeriod, isWorse } from "./normalize";

// Priority order for the single headline number: freshest + most universal first.
const HEADLINE_ORDER = ["Hybrid_HWR", "READM_30_HF", "READM_30_COPD", "READM_30_PN"];

function presentRates(rec: HospitalRecord): RateMeasure[] {
  return Object.values(rec.rates ?? {}).filter((m) => m.score !== null);
}

function endKey(period: { end: string }): number {
  const [mm, dd, yyyy] = period.end.split("/");
  return Number(`${yyyy}${mm}${dd}`) || 0;
}

function cleanType(type: string | null): string | null {
  return type ? type.replace(/Hospitals$/, "Hospital").trim() : null;
}

/**
 * Turn a hospital record into a tier-aware readout that ALWAYS has a meaningful
 * headline — leading with the freshest signal and labeling every figure's date.
 * Pure: shard in, profile out. Reused by web + CLI + future MCP.
 */
export function buildProfile(hospitalId: string, shard: HospitalRecord[]): HospitalProfile {
  const rec = shard.find((h) => h.id === hospitalId);
  if (!rec) throw new Error(`Hospital ${hospitalId} not found in shard`);

  const benchmark = benchmarkHospital(hospitalId, shard);
  const rates = presentRates(rec);
  const byId = new Map(rates.map((m) => [m.id, m]));
  const rating = rec.overall?.rating ?? null;

  // ----- Headline: freshest, most universal signal that exists -----
  const headlineRate = HEADLINE_ORDER.map((id) => byId.get(id)).find(Boolean) ?? rates[0];
  let headline: HospitalProfile["headline"];
  if (headlineRate) {
    headline = {
      kind: "rate",
      label: RATE_LABELS[headlineRate.id] ?? headlineRate.id,
      value: `${headlineRate.score}%`,
      asOf: formatPeriod(headlineRate.period),
      worse: isWorse(headlineRate.comparedToNational),
      comparedToNational: headlineRate.comparedToNational,
    };
  } else if (rating !== null) {
    headline = {
      kind: "rating",
      label: "CMS overall hospital rating",
      value: `${rating} of 5 stars`,
      asOf: null,
      worse: rating <= 2 ? true : rating >= 4 ? false : null,
      comparedToNational: null,
    };
  } else {
    headline = {
      kind: "descriptor",
      label: cleanType(rec.hospitalType) ?? "Hospital",
      value: rec.overall?.ownership ?? "CMS publishes no comparative scores for this facility",
      asOf: null,
      worse: null,
      comparedToNational: null,
    };
  }

  // ----- Burden line: how many patients actually came back within 30 days -----
  // CMS publishes the rate and the cohort size (denominator) but not always the
  // raw return count, so derive it: rate% x cohort. Both numbers are CMS's own.
  const isReadmissionRate = (id: string) => id === "Hybrid_HWR" || id.startsWith("READM_30_");
  const burdenSrc =
    headlineRate && isReadmissionRate(headlineRate.id) && headlineRate.score !== null
      ? headlineRate
      : rates.find((m) => isReadmissionRate(m.id) && m.score !== null && m.denominator !== null) ??
        null;
  const burden =
    burdenSrc && burdenSrc.score !== null
      ? {
          returned:
            burdenSrc.returned ??
            (burdenSrc.denominator !== null
              ? Math.round((burdenSrc.score / 100) * burdenSrc.denominator)
              : 0),
          denominator: burdenSrc.denominator,
          label: RATE_LABELS[burdenSrc.id] ?? burdenSrc.id,
          asOf: formatPeriod(burdenSrc.period),
        }
      : null;

  // ----- Recency ladder: every present rate, freshest first -----
  const recency: RecencyItem[] = [...rates]
    .sort((a, b) => endKey(b.period) - endKey(a.period))
    .map((m) => ({
      id: m.id,
      label: RATE_LABELS[m.id] ?? m.id,
      value: `${m.score}%`,
      comparedToNational: m.comparedToNational,
      asOf: formatPeriod(m.period),
      worse: isWorse(m.comparedToNational),
    }));

  // ----- Tier -----
  const tier: CoverageTier =
    benchmark.reportedCount > 0 ? "full" : rates.length > 0 || rating !== null ? "partial" : "backbone";

  return {
    hospital: {
      id: rec.id,
      name: rec.name,
      state: rec.state,
      county: rec.county,
      type: cleanType(rec.hospitalType),
    },
    tier,
    headline,
    burden,
    recency,
    benchmark,
    rating,
  };
}
