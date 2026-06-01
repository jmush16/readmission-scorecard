#!/usr/bin/env node
// Build-time data pipeline for the Readmission Reality Check.
//
// CMS provider-data sends no CORS header, so the browser cannot fetch it
// directly. We pull it once here, normalize + join + shard, and commit the
// result to public/data/. Refreshed by a scheduled GitHub Action.
//
//   npm run build:data
//
// Sources (all CMS provider-data):
//   xubh-q36u  Hospital General Information  -> the universe (every hospital) + rating
//   9n3s-kdb3  HRRP                          -> excess ratio + penalty (lagged audit)
//   632h-zaca  Unplanned Hospital Visits     -> rates incl. fresher 2023-24 / 2024 measures
//   fykj-qjee  SNF Quality Reporting (long)  -> post-acute: 30-day rehospitalization + DTC (county-scoped)
//   6jpm-sxkc  Home Health agency data       -> post-acute: PPH / PPR / DTC (state-scoped, no county)
//   97z8-de96  Home Health national row      -> the published national reference rates

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  MEASURE_TO_CONDITION,
  RATE_MEASURE_IDS,
  type ConditionKey,
  type HospitalRecord,
  type HospitalIndexEntry,
  type PostAcuteShard,
  type RateMeasure,
  type SnapshotManifest,
  type SnfAggregate,
} from "../src/lib/hrrp/types";
import { median, num, round } from "../src/lib/hrrp/normalize";
import {
  aggregateHh,
  aggregateSnf,
  type HhAgencyRaw,
  type SnfFacilityRaw,
} from "../src/lib/hrrp/postacute";

const API = "https://data.cms.gov/provider-data/api/1/datastore/query";
const PAGE = 1000;
const OUT = join(process.cwd(), "public", "data");

interface Row {
  [k: string]: string;
}

async function fetchAll(datasetId: string): Promise<Row[]> {
  const out: Row[] = [];
  let offset = 0;
  for (;;) {
    const url = `${API}/${datasetId}/0?limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${datasetId} HTTP ${res.status} at offset ${offset}`);
    const json = (await res.json()) as { results?: Row[] };
    const rows = json.results ?? [];
    out.push(...rows);
    process.stdout.write(`\r  ${datasetId}: ${out.length} rows`);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  process.stdout.write("\n");
  return out;
}

/**
 * Fetch a single measure_code from a long-format dataset (e.g. SNF QRP, which
 * is 837k rows across ~56 codes). Server-side filtering keeps us to the ~15k
 * rows we actually need instead of paginating the whole file.
 */
async function fetchFiltered(datasetId: string, property: string, value: string): Promise<Row[]> {
  const out: Row[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      limit: String(PAGE),
      offset: String(offset),
      "conditions[0][property]": property,
      "conditions[0][value]": value,
      "conditions[0][operator]": "=",
    });
    const url = `${API}/${datasetId}/0?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${datasetId}/${value} HTTP ${res.status} at offset ${offset}`);
    const json = (await res.json()) as { results?: Row[] };
    const rows = json.results ?? [];
    out.push(...rows);
    process.stdout.write(`\r  ${datasetId} ${value}: ${out.length} rows`);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  process.stdout.write("\n");
  return out;
}

function rollup(r: Row, group: string) {
  const n = (k: string) => num(r[k]);
  return {
    measureCount: n(`count_of_facility_${group}_measures`),
    better: n(`count_of_${group}_measures_better`),
    noDifferent: n(`count_of_${group}_measures_no_different`),
    worse: n(`count_of_${group}_measures_worse`),
  };
}

async function main() {
  console.log("Fetching CMS data (no CORS, so this runs at build time)...");
  const [hospitals, hrrp, unplanned] = await Promise.all([
    fetchAll("xubh-q36u"),
    fetchAll("9n3s-kdb3"),
    fetchAll("632h-zaca"),
  ]);

  // ----- 1. Build the universe from Hospital General Information -----
  const byId = new Map<string, HospitalRecord>();
  for (const h of hospitals) {
    if (!h.facility_id || !h.state) continue;
    byId.set(h.facility_id, {
      id: h.facility_id,
      name: (h.facility_name ?? "").trim(),
      state: h.state,
      county: h.countyparish?.trim() || null,
      hospitalType: h.hospital_type?.trim() || null,
      measures: {},
      overall: {
        rating: num(h.hospital_overall_rating),
        ownership: h.hospital_ownership?.trim() || null,
        emergencyServices: h.emergency_services ? /^y/i.test(h.emergency_services) : null,
        readm: rollup(h, "readm"),
        mortality: rollup(h, "mort"),
        safety: rollup(h, "safety"),
      },
      rates: {},
    });
  }

  // ----- 2. Join HRRP (excess ratio + penalty) -----
  let suppressedRatios = 0;
  let period = { start: "", end: "" };
  let hrrpOrphans = 0;
  for (const r of hrrp) {
    const condition = MEASURE_TO_CONDITION[r.measure_name] as ConditionKey | undefined;
    if (!condition) continue;
    const rec = byId.get(r.facility_id);
    if (!rec) {
      hrrpOrphans += 1;
      continue;
    }
    if (!period.start && r.start_date) period = { start: r.start_date, end: r.end_date };
    const excessRatio = num(r.excess_readmission_ratio);
    if (excessRatio === null) suppressedRatios += 1;
    rec.measures[condition] = {
      condition,
      excessRatio,
      predicted: num(r.predicted_readmission_rate),
      expected: num(r.expected_readmission_rate),
      discharges: num(r.number_of_discharges),
      readmissions: num(r.number_of_readmissions),
      suppressed: excessRatio === null,
    };
  }

  // ----- 3. Join the whitelisted rate measures (drop suppressed to save bytes) -----
  const whitelist = new Set(RATE_MEASURE_IDS);
  const measurePeriods: Record<string, { start: string; end: string }> = {};
  for (const r of unplanned) {
    const id = r.measure_id;
    if (!whitelist.has(id)) continue;
    const rec = byId.get(r.facility_id);
    if (!rec) continue;
    if (!measurePeriods[id] && r.start_date) {
      measurePeriods[id] = { start: r.start_date, end: r.end_date };
    }
    const score = num(r.score);
    if (score === null) continue; // suppressed; absence = suppressed downstream
    const m: RateMeasure = {
      id,
      score,
      comparedToNational: r.compared_to_national?.trim() || null,
      denominator: num(r.denominator),
      patients: num(r.number_of_patients),
      returned: num(r.number_of_patients_returned),
      period: { start: r.start_date, end: r.end_date },
      footnote: null,
    };
    rec.rates![id] = m;
  }

  // ----- 3b. Post-acute layer: where discharged patients GO -----
  // SNF QRP is long-format and carries its own county, so we filter to the four
  // codes we need and pivot by CCN. Home Health has no county field, so it
  // aggregates at the state level. PPR_RSRR is the spine (name/state/county).
  const SNF = "fykj-qjee";
  console.log("Fetching post-acute data (SNF QRP filtered by measure, Home Health)...");
  const [snfRsrr, snfRsrrVerdict, snfDtc, snfDtcVerdict, hh, hhNational] = await Promise.all([
    fetchFiltered(SNF, "measure_code", "S_004_01_PPR_PD_RSRR"),
    fetchFiltered(SNF, "measure_code", "S_004_01_PPR_PD_COMP_PERF"),
    fetchFiltered(SNF, "measure_code", "S_005_02_DTC_RS_RATE"),
    fetchFiltered(SNF, "measure_code", "S_005_02_DTC_COMP_PERF"),
    fetchAll("6jpm-sxkc"),
    fetchAll("97z8-de96"),
  ]);

  const snfPeriod = snfRsrr[0]?.start_date
    ? { start: snfRsrr[0].start_date, end: snfRsrr[0].end_date }
    : { start: "", end: "" };
  const hhPeriod = { start: "", end: "" }; // HH agency file carries no measure window

  // COMP_PERF / DTC rows carry the verdict (or value) in `score`, keyed by CCN.
  const pprVerdictBy = new Map(snfRsrrVerdict.map((r) => [r.cms_certification_number_ccn, r.score?.trim() || null]));
  const dtcRateBy = new Map(snfDtc.map((r) => [r.cms_certification_number_ccn, num(r.score)]));

  const snfByState = new Map<string, SnfFacilityRaw[]>();
  const snfByStateCounty = new Map<string, Map<string, SnfFacilityRaw[]>>();
  for (const r of snfRsrr) {
    if (!r.state) continue;
    const county = r.countyparish?.trim().toUpperCase() || null;
    const fac: SnfFacilityRaw = {
      name: (r.provider_name ?? "").trim(),
      county,
      ppr: num(r.score),
      pprVerdict: pprVerdictBy.get(r.cms_certification_number_ccn) ?? null,
      dtc: dtcRateBy.get(r.cms_certification_number_ccn) ?? null,
    };
    (snfByState.get(r.state) ?? snfByState.set(r.state, []).get(r.state)!).push(fac);
    if (county) {
      let cm = snfByStateCounty.get(r.state);
      if (!cm) snfByStateCounty.set(r.state, (cm = new Map()));
      (cm.get(county) ?? cm.set(county, []).get(county)!).push(fac);
    }
  }
  if (snfByState.size === 0) {
    throw new Error("SNF QRP returned no PPR rows — the measure code may have changed.");
  }

  const hhByState = new Map<string, HhAgencyRaw[]>();
  for (const r of hh) {
    if (!r.state) continue;
    (hhByState.get(r.state) ?? hhByState.set(r.state, []).get(r.state)!).push({
      pph: num(r.pph_riskstandardized_rate),
      pphVerdict: r.pph_performance_categorization?.trim() || null,
      ppr: num(r.ppr_riskstandardized_rate),
      dtc: num(r.dtc_riskstandardized_rate),
    });
  }
  const hhAgencyCount = hh.length;
  if (![...hhByState.values()].flat().some((a) => a.pph !== null)) {
    throw new Error("Home Health PPH column missing/empty — the HHVBP measure set may have changed.");
  }

  // National reference: HH from CMS's published national row; SNF from the
  // snapshot median of reporting facilities (CMS publishes no SNF national rate).
  const natRow = hhNational[0] ?? {};
  const allSnfPpr = [...snfByState.values()].flat().map((f) => f.ppr).filter((n): n is number => n !== null);
  const snfPprNationalMedian = median(allSnfPpr);
  const national = {
    snfPprMedian: snfPprNationalMedian === null ? null : round(snfPprNationalMedian, 1),
    hhPph: num(natRow.pph_national_observed_rate),
    hhPpr: num(natRow.ppr_national_observed_rate),
    hhDtc: num(natRow.dtc_national_observed_rate),
  };

  // ----- 4. Shard + write -----
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "states"), { recursive: true });
  mkdirSync(join(OUT, "postacute"), { recursive: true });

  const byState = new Map<string, HospitalRecord[]>();
  const index: HospitalIndexEntry[] = [];
  let withRates = 0;
  for (const rec of byId.values()) {
    if (Object.keys(rec.rates ?? {}).length > 0) withRates += 1;
    (byState.get(rec.state) ?? byState.set(rec.state, []).get(rec.state)!).push(rec);
    index.push({ id: rec.id, name: rec.name, state: rec.state, county: rec.county });
  }

  const states = [...byState.keys()].sort();
  let maxShard = 0;
  for (const st of states) {
    const list = byState.get(st)!.sort((a, b) => a.name.localeCompare(b.name));
    const json = JSON.stringify(list);
    maxShard = Math.max(maxShard, json.length);
    writeFileSync(join(OUT, "states", `${st}.json`), json);
  }
  if (maxShard > 1_400_000) {
    throw new Error(`A state shard is ${(maxShard / 1e6).toFixed(2)} MB — too large; trim measures.`);
  }

  // Post-acute shards: one per state (so the lazy fetch never 404s). Aggregates
  // + top-3 only, kept separate from the hospital shards so we add zero bytes
  // to the hot path.
  let maxPa = 0;
  let snfCounties = 0;
  let snfFacilities = 0;
  for (const st of states) {
    const stateSnf = snfByState.get(st) ?? null;
    const stateHh = hhByState.get(st) ?? null;
    const countyMap = snfByStateCounty.get(st);
    const counties: Record<string, { snf: SnfAggregate | null }> = {};
    if (countyMap) {
      for (const [cty, facs] of countyMap) {
        counties[cty] = { snf: aggregateSnf(facs) };
        snfCounties += 1;
      }
    }
    snfFacilities += stateSnf?.length ?? 0;
    const shard: PostAcuteShard = {
      national,
      state: {
        snf: stateSnf ? aggregateSnf(stateSnf) : null,
        hh: stateHh ? aggregateHh(stateHh) : null,
      },
      counties,
    };
    const json = JSON.stringify(shard);
    maxPa = Math.max(maxPa, json.length);
    writeFileSync(join(OUT, "postacute", `${st}.json`), json);
  }
  if (maxPa > 1_400_000) {
    throw new Error(`A post-acute shard is ${(maxPa / 1e6).toFixed(2)} MB — too large; trim top-N or fields.`);
  }

  index.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(OUT, "hospitals.json"), JSON.stringify(index));

  const manifest: SnapshotManifest = {
    version: 3,
    fetchedAt: new Date().toISOString(),
    hrrpPeriod: period,
    sources: {
      hrrp: "9n3s-kdb3",
      hospitals: "xubh-q36u",
      unplanned: "632h-zaca",
      snfQrp: SNF,
      homeHealth: "6jpm-sxkc",
      homeHealthNational: "97z8-de96",
    },
    states,
    conditions: ["HF", "COPD", "PN", "AMI", "HIP_KNEE", "CABG"],
    measurePeriods,
    postAcutePeriods: { snfPpr: snfPeriod, homeHealth: hhPeriod },
    counts: {
      hospitals: byId.size,
      withRates,
      suppressedRatios,
      snfFacilities,
      hhAgencies: hhAgencyCount,
      snfCounties,
    },
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `\nDone. ${byId.size} hospitals across ${states.length} states; ${withRates} have rate measures. ` +
      `${suppressedRatios} suppressed HRRP ratios. ${hrrpOrphans} HRRP orphans dropped. ` +
      `Largest hospital shard ${(maxShard / 1e6).toFixed(2)} MB.\n` +
      `Post-acute: ${snfFacilities} SNFs across ${snfCounties} state-counties, ${hhAgencyCount} home-health agencies. ` +
      `Largest post-acute shard ${(maxPa / 1e6).toFixed(2)} MB.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
