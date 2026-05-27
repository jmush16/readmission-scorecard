#!/usr/bin/env node
// Readmission Reality Check — CLI surface.
// Reuses the exact benchmark core as the web tool, reading the committed
// snapshot. Any coding agent can shell into this; no network, no PHI.
//
//   npm run benchmark -- --name "winchester"          # search by name
//   npm run benchmark -- --id 220078                  # exact CCN
//   npm run benchmark -- --name winchester --json     # machine-readable

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { benchmarkHospital } from "../src/lib/hrrp/benchmark";
import { buildProfile } from "../src/lib/hrrp/profile";
import { researchPrompt } from "../src/lib/hrrp/research";
import type {
  BenchmarkResult,
  HospitalIndexEntry,
  HospitalRecord,
  SnapshotManifest,
} from "../src/lib/hrrp/types";

const DATA = join(process.cwd(), "public", "data");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function loadIndex(): HospitalIndexEntry[] {
  return JSON.parse(readFileSync(join(DATA, "hospitals.json"), "utf8"));
}

function loadState(state: string): HospitalRecord[] {
  return JSON.parse(readFileSync(join(DATA, "states", `${state}.json`), "utf8"));
}

function findEntry(): HospitalIndexEntry {
  const index = loadIndex();
  const id = arg("--id");
  if (id) {
    const hit = index.find((h) => h.id === id);
    if (!hit) throw new Error(`No hospital with CCN ${id}`);
    return hit;
  }
  const name = arg("--name");
  if (!name) {
    console.error('Provide --name "<text>" or --id <CCN>.');
    process.exit(1);
  }
  const matches = index.filter((h) => h.name.toLowerCase().includes(name.toLowerCase()));
  if (matches.length === 0) throw new Error(`No hospital matching "${name}"`);
  if (matches.length > 1) {
    console.error(`"${name}" matches ${matches.length} hospitals:`);
    for (const m of matches.slice(0, 12)) console.error(`  ${m.id}  ${m.name}, ${m.state}`);
    if (matches.length > 12) console.error(`  ...and ${matches.length - 12} more. Narrow it or use --id.`);
    process.exit(1);
  }
  return matches[0];
}

function pct(rank: number, peers: number): string {
  return `${rank} of ${peers}`;
}

function printHuman(r: BenchmarkResult) {
  console.log(`\n${r.hospital.name} — ${r.hospital.county ?? "?"} County, ${r.hospital.state}`);
  console.log(`Penalized on ${r.penalizedCount} of ${r.reportedCount} reported conditions.\n`);
  for (const c of r.conditions) {
    if (c.suppressed) {
      console.log(`  ${c.label.padEnd(26)} — CMS-suppressed (too few cases)`);
      continue;
    }
    const flag = c.penalized ? "⚠ PENALTY" : "ok";
    console.log(
      `  ${c.label.padEnd(26)} ratio ${c.excessRatio}  ` +
        `rank ${pct(c.rank!, c.peerCount)} in ${r.hospital.state}  ` +
        `(median ${c.stateMedian}, best ${c.stateBest})  ${flag}`,
    );
  }
  if (r.worst) {
    console.log(
      `\nBiggest gap vs. state peers: ${r.worst.label} ` +
        `(${r.worst.excessRatio}, ${r.worst.gapToMedian} above the state median).`,
    );
  }
  console.log("\nSource: CMS Hospital Readmissions Reduction Program (public, non-PHI).");
}

function loadManifest(): SnapshotManifest {
  return JSON.parse(readFileSync(join(DATA, "manifest.json"), "utf8"));
}

function main() {
  const entry = findEntry();
  const shard = loadState(entry.state);
  if (process.argv.includes("--profile")) {
    console.log(JSON.stringify(buildProfile(entry.id, shard), null, 2));
    return;
  }
  const result = benchmarkHospital(entry.id, shard);
  if (process.argv.includes("--research")) {
    console.log(researchPrompt(result, loadManifest().hrrpPeriod));
  } else if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
}

main();
