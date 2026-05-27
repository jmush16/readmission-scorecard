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

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  MEASURE_TO_CONDITION,
  RATE_MEASURE_IDS,
  type ConditionKey,
  type HospitalRecord,
  type HospitalIndexEntry,
  type RateMeasure,
  type SnapshotManifest,
} from "../src/lib/hrrp/types";
import { num } from "../src/lib/hrrp/normalize";

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

  // ----- 4. Shard + write -----
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "states"), { recursive: true });

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

  index.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(OUT, "hospitals.json"), JSON.stringify(index));

  const manifest: SnapshotManifest = {
    version: 2,
    fetchedAt: new Date().toISOString(),
    hrrpPeriod: period,
    sources: { hrrp: "9n3s-kdb3", hospitals: "xubh-q36u", unplanned: "632h-zaca" },
    states,
    conditions: ["HF", "COPD", "PN", "AMI", "HIP_KNEE", "CABG"],
    measurePeriods,
    counts: { hospitals: byId.size, withRates, suppressedRatios },
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `\nDone. ${byId.size} hospitals across ${states.length} states; ${withRates} have rate measures. ` +
      `${suppressedRatios} suppressed HRRP ratios. ${hrrpOrphans} HRRP orphans dropped. ` +
      `Largest shard ${(maxShard / 1e6).toFixed(2)} MB.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
