import type {
  HhAggregate,
  PostAcuteShard,
  ResolvedPostAcute,
  SnfAggregate,
} from "./types";
import { isWorse, median, round } from "./normalize";

// Pure post-acute core: turn raw CMS rows into county/state aggregates, and
// resolve one hospital's county to a usable read. No I/O. All medians, "worse"
// counts, and top-N are computed over non-suppressed rows only — the same
// discipline as benchmark.ts, so suppressed cells never silently distort a
// figure. Reused by the build pipeline (aggregate*) and the web UI (resolve).

/** Need at least this many *reporting* SNFs in a county to trust its median. */
export const MIN_COUNTY_SNFS = 2;
const TOP_N = 3;

const VERDICT_SUPPRESSED = new Set(["", "-", "n/a", "na", "not available", "not applicable"]);

/**
 * Does a facility have a real CMS comparative verdict (better / same / worse),
 * as opposed to a suppression sentinel? "No Different than the National Rate"
 * counts — it belongs in the denominator, just not the "worse" numerator.
 */
function hasVerdict(v: string | null): boolean {
  return !!v && !VERDICT_SUPPRESSED.has(v.trim().toLowerCase());
}

// ----- Aggregation inputs (already parsed: build runs num() first) -----

export interface SnfFacilityRaw {
  name: string;
  county: string | null; // UPPER
  ppr: number | null; // 30-day potentially-preventable rehospitalization (RSRR %)
  pprVerdict: string | null; // CMS comparative-performance string
  dtc: number | null; // successful discharge to community (RSRR %)
}

export interface HhAgencyRaw {
  pph: number | null; // potentially-preventable hospitalization during HH episode
  pphVerdict: string | null;
  ppr: number | null; // potentially-preventable readmission
  dtc: number | null; // discharge to community
}

/** Roll up the SNFs in one geography. `count` = facilities CMS tracks here. */
export function aggregateSnf(facilities: SnfFacilityRaw[]): SnfAggregate {
  const pprRates = facilities.map((f) => f.ppr).filter((n): n is number => n !== null);
  const dtcRates = facilities.map((f) => f.dtc).filter((n): n is number => n !== null);
  const verdicted = facilities.filter((f) => hasVerdict(f.pprVerdict));
  const worseCount = facilities.filter((f) => isWorse(f.pprVerdict) === true).length;

  const topWorst = [...facilities]
    .filter((f) => f.ppr !== null)
    .sort((a, b) => (b.ppr as number) - (a.ppr as number))
    .slice(0, TOP_N)
    .map((f) => ({
      name: f.name,
      county: f.county,
      rate: f.ppr,
      verdict: f.pprVerdict,
      worse: isWorse(f.pprVerdict),
    }));

  const pprMedian = median(pprRates);
  const dtcMedian = median(dtcRates);
  return {
    count: facilities.length,
    reporting: pprRates.length,
    pprMedian: pprMedian === null ? null : round(pprMedian, 1),
    dtcMedian: dtcMedian === null ? null : round(dtcMedian, 1),
    worseCount,
    verdictCount: verdicted.length,
    topWorst,
  };
}

/** Roll up the Home Health agencies in one state (no county precision). */
export function aggregateHh(agencies: HhAgencyRaw[]): HhAggregate {
  const pph = agencies.map((a) => a.pph).filter((n): n is number => n !== null);
  const ppr = agencies.map((a) => a.ppr).filter((n): n is number => n !== null);
  const dtc = agencies.map((a) => a.dtc).filter((n): n is number => n !== null);
  const verdicted = agencies.filter((a) => hasVerdict(a.pphVerdict));
  const worseCount = agencies.filter((a) => isWorse(a.pphVerdict) === true).length;

  const m = (xs: number[]) => {
    const v = median(xs);
    return v === null ? null : round(v, 1);
  };
  return {
    count: agencies.length,
    reporting: pph.length,
    pphMedian: m(pph),
    pprMedian: m(ppr),
    dtcMedian: m(dtc),
    worseCount,
    verdictCount: verdicted.length,
  };
}

/**
 * Resolve a hospital's county to a post-acute read. SNF prefers the county
 * aggregate but falls back to the state roll-up when the county is missing or
 * has too few reporting facilities (`usedState`). Home Health is always
 * state-scoped. Pure: shard + county in, resolved read out.
 */
export function postAcuteForCounty(shard: PostAcuteShard, county: string | null): ResolvedPostAcute {
  const key = county ? county.trim().toUpperCase() : null;
  const countySnf = key ? shard.counties[key]?.snf ?? null : null;

  let snf: SnfAggregate | null;
  let usedState: boolean;
  if (countySnf && countySnf.reporting >= MIN_COUNTY_SNFS) {
    snf = countySnf;
    usedState = false;
  } else {
    snf = shard.state.snf;
    usedState = true;
  }

  return { snf, usedState, county: key, hh: shard.state.hh, national: shard.national };
}

/**
 * A short, honest sentence for the one-pager: how the nearby post-acute setting
 * performs on returning patients to the hospital. Empty string when we have no
 * usable signal (never invent one).
 */
export function summarizePostAcute(r: ResolvedPostAcute): string {
  const out: string[] = [];
  if (r.snf && r.snf.verdictCount > 0) {
    const scope = r.usedState ? "statewide" : "in this county";
    out.push(
      `${r.snf.worseCount} of ${r.snf.verdictCount} nearby SNFs (${scope}) rehospitalize ` +
        `patients at a rate CMS flags as worse than the national rate` +
        (r.snf.pprMedian !== null ? ` (median ${r.snf.pprMedian}% rehospitalized within 30 days)` : ""),
    );
  }
  if (r.hh && r.hh.pphMedian !== null && r.national.hhPph !== null) {
    out.push(
      `Statewide home-health agencies send a median ${r.hh.pphMedian}% of patients to a ` +
        `potentially-preventable hospitalization during the episode, vs ${r.national.hhPph}% nationally`,
    );
  }
  return out.join(". ");
}
