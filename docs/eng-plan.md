# Engineering Plan: HRRP Readmission Benchmark + Opportunity Map

## 1. Feasibility tests (run live 2026-05-27, not speculation)

### CORS
| Source | Dataset | `Access-Control-Allow-Origin`? | Browser fetch from GitHub Pages? |
|---|---|---|---|
| CMS HRRP | `9n3s-kdb3` | **Absent** (GET and OPTIONS preflight) | **BLOCKED** |
| CMS Hospital General Info | `xubh-q36u` | **Absent** | **BLOCKED** |
| CDC PLACES (Socrata) | `swc5-untb` | **`*`** | **ALLOWED** |

### Size & pagination (HRRP `9n3s-kdb3`)
- 18,330 rows. Page-size cap **1,000** (`limit>1000` silently returns 0). Full pull = ~19 requests via `offset`.
- Full dataset minified JSON: **2.3 MB raw / 303 KB gzipped**. Too big to eager-bundle; fine sharded per state (~50 KB each).

### Small-cell suppression (must handle)
- 6,610 rows have `excess_readmission_ratio = "N/A"`; 10,088 have `number_of_discharges = "N/A"`; `number_of_readmissions` carries the string `"Too Few to Report"`. These are strings → naive `Number()` = `NaN`. CMS suppresses cells under ~25 eligible discharges.

### Hospital→county join
- HRRP has **no county/ZIP/address**. Join via **CMS Hospital General Information `xubh-q36u`** (5,432 rows, same `facility_id`/CCN) which adds `countyparish`, `zip_code`, `hospital_type`, `hospital_ownership`. Then CCN → county → CDC PLACES (`locationname` + `stateabbr`). Normalize county-name case; pin one PLACES year + `data_value_type=CrdPrv`.

### Trend (scope correction)
- HRRP snapshot is a **single reporting period 07/01/2021–06/30/2024** — no year-over-year series in this dataset. Drop "3-year trend" from v1 (or backfill archived prior-year HRRP files separately).

## 2. Decision: build-time data snapshot (not live browser fetch)
Commit a normalized snapshot to the repo, refreshed by a scheduled GitHub Action. Rationale: CMS CORS blocks browser fetch and a backend is forbidden by the constraints; size/pagination favor doing the work once and shipping compact per-state shards; a committed snapshot is reproducible, diffable in PRs, and stays 100% non-PHI. CDC PLACES could be live but is pulled at build time too for one coherent versioned artifact. Refresh: monthly `cron` + `workflow_dispatch` (HRRP updates ~annually).

## 3. Architecture (preserves the pure-core pattern)

### A. Data pipeline (build-time, Node, committed output) — `scripts/`
- `fetch-cms-hrrp.ts` (offset loop, cap 1000, backoff), `fetch-cms-hospitals.ts` (CCN→county crosswalk), `fetch-cdc-places.ts` (Socrata, filtered to HF-relevant measures: CHD, COPD, DIABETES, BPHIGH, OBESITY, STROKE; pinned year + CrdPrv), `build-snapshot.ts` (normalize → CCN join → PLACES county join → shard per state → manifest with provenance + suppression counts).
- Output under `src/data/snapshot/` (or `public/data/`): `index.json` (manifest), `states/<ST>.json` (per-state shard), `hospitals/index.json` (lightweight picker index).

### B. Pure reusable core — `src/lib/hrrp/`
- `types.ts` — `HospitalRecord`, `ConditionMeasure`, `MarketRow`, `BenchmarkResult`, `MarketResult`, `Suppressed<T>`.
- `normalize.ts` — string→number with explicit suppression: `"N/A"`/`"Too Few to Report"`/`""` → `{ value: null, suppressed: true }`. Never silently `NaN`.
- `benchmark.ts` (Operator core, pure) — given `facility_id` + state shard: per-condition excess ratio, penalty flag (`ERR > 1.0`), state rank, gap to median/best, peer set, export package.
- `market.ts` (Risk-owner core, pure) — given state (+ condition/type filter) + shard: hospitals ranked by excess ratio + penalty, county prevalence overlay, opportunity rollup (total excess readmissions = `number_of_readmissions − expected`, summed over non-suppressed rows only — CMS-published numbers, no fabricated dollars).

### C. Surfaces (thin adapters)
- Web (`src/main.ts` + view modules): role gate → load shard → call `benchmark` or `market` → render. Reuse existing audience-toggle/export plumbing.
- CLI (`cli/benchmark.ts`, `cli/market.ts`) over the committed snapshot.
- Future MCP: same core functions as tools (`benchmark_hospital`, `rank_market`).

Both persona views read the **same per-state shard** through the **same core**; only the cut and conclusion differ.

## 4. Build steps
1. Types + `normalize.ts` first, with unit tests against real suppression strings.
2. Fetchers (each writes a raw cache for cheap, diffable re-runs).
3. `build-snapshot.ts`: normalize → CCN join → PLACES join → shard → manifest.
4. Operator core + view (+ tests on a fixture shard), one-pager export.
5. Risk-owner core + view (+ tests): ranked table + prevalence overlay + opportunity rollup.
6. CLI adapters.
7. Demote old self-assessment to optional step 2 behind the real data.
8. `.github/workflows/refresh-data.yml` (monthly cron + dispatch) opens a refresh PR; keep `npm test` + `npm run build` gating deploy.

### Top risks & mitigations
- CMS CORS → build-time snapshot (resolved).
- Bundle size 2.3 MB → per-state shards on demand + tiny hospital index.
- Schema drift → manifest records source IDs + timestamp; builder validates expected fields and fails the Action loudly; last good snapshot keeps site live.
- Small-cell / "Too Few to Report" → `Suppressed<T>` forces null handling; ranks/medians/sums over non-suppressed rows only; UI shows "CMS-suppressed" explicitly; no imputation.
- Hospital→county join → verified `xubh-q36u` crosswalk; case-fold county names; pin one PLACES year; flag (don't drop) unmatched hospitals.
- "3-year trend" not in dataset → drop from v1; no fabricated series.
- No fabricated ROI → opportunity sizing uses only CMS-published readmissions/expected; surface the gap, never invent dollar savings.
