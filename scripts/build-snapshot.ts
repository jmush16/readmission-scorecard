#!/usr/bin/env node
// Build-time data pipeline for the Readmission Reality Check.
//
// CMS provider-data sends no CORS header, so the browser cannot fetch it
// directly. We pull it once here, normalize + join + shard, and commit the
// result to public/data/. Refreshed by a scheduled GitHub Action.
//
//   npm run build:data
//
// Sources:
//   HRRP            9n3s-kdb3  (excess readmission ratios, by hospital + condition)
//   Hospital info   xubh-q36u  (CCN -> county / type crosswalk)

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  MEASURE_TO_CONDITION,
  type ConditionKey,
  type HospitalRecord,
  type HospitalIndexEntry,
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

async function main() {
  console.log("Fetching CMS data (no CORS, so this runs at build time)...");
  const [hrrp, hospitals] = await Promise.all([
    fetchAll("9n3s-kdb3"),
    fetchAll("xubh-q36u"),
  ]);

  // CCN -> county / type crosswalk.
  const crosswalk = new Map<string, { county: string | null; type: string | null }>();
  for (const h of hospitals) {
    crosswalk.set(h.facility_id, {
      county: h.countyparish?.trim() || null,
      type: h.hospital_type?.trim() || null,
    });
  }

  // Assemble hospital records keyed by CCN.
  const byId = new Map<string, HospitalRecord>();
  let suppressedRatios = 0;
  let period = { start: "", end: "" };

  for (const r of hrrp) {
    const condition = MEASURE_TO_CONDITION[r.measure_name] as ConditionKey | undefined;
    if (!condition) continue;
    if (!period.start && r.start_date) period = { start: r.start_date, end: r.end_date };

    let rec = byId.get(r.facility_id);
    if (!rec) {
      const cw = crosswalk.get(r.facility_id);
      rec = {
        id: r.facility_id,
        name: (r.facility_name ?? "").trim(),
        state: r.state,
        county: cw?.county ?? null,
        hospitalType: cw?.type ?? null,
        measures: {},
      };
      byId.set(r.facility_id, rec);
    }

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

  // Shard by state.
  const byState = new Map<string, HospitalRecord[]>();
  const index: HospitalIndexEntry[] = [];
  for (const rec of byId.values()) {
    if (!rec.state) continue;
    (byState.get(rec.state) ?? byState.set(rec.state, []).get(rec.state)!).push(rec);
    index.push({ id: rec.id, name: rec.name, state: rec.state, county: rec.county });
  }

  // Write output.
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "states"), { recursive: true });

  const states = [...byState.keys()].sort();
  for (const st of states) {
    const list = byState.get(st)!.sort((a, b) => a.name.localeCompare(b.name));
    writeFileSync(join(OUT, "states", `${st}.json`), JSON.stringify(list));
  }

  index.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(OUT, "hospitals.json"), JSON.stringify(index));

  const manifest: SnapshotManifest = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    hrrpPeriod: period,
    sources: { hrrp: "9n3s-kdb3", hospitals: "xubh-q36u" },
    states,
    conditions: ["HF", "COPD", "PN", "AMI", "HIP_KNEE", "CABG"],
    counts: { hospitals: byId.size, hrrpRows: hrrp.length, suppressedRatios },
  };
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(
    `\nDone. ${byId.size} hospitals across ${states.length} states. ` +
      `${suppressedRatios} suppressed ratios. HRRP period ${period.start}–${period.end}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
