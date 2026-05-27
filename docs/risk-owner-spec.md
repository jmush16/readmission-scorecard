# Spec: Risk-owner market opportunity map (v2)

Status: planned. Builds on the shipped operator benchmark and the same snapshot
pipeline. This is the second door ("Map my market") on the landing gate.

## Who + job to be done
Buyer titles: ACO Medical Director, CMO, VP Population Health, VP Value-Based
Care, Director of Medical Economics, CFO. They own the metric AND the budget.

JTBD: "I'm deciding where to invest scarce care-management dollars across my
network/market. Show me which facilities and conditions carry the most excess
readmissions and penalty exposure, so I target the biggest, most defensible
opportunity instead of spreading thin."

Honesty framing (design lead's caveat): a sophisticated buyer may already have
their own numbers — so lead with what they *don't* have: **their whole market,
externally benchmarked, every hospital named and ranked.**

## The data product
Input: state (required) + condition filter (default: all 6) + optional
hospital-type filter (Acute Care vs Critical Access, from the crosswalk).

Output: a ranked table of every hospital in the market with —
- excess readmission ratio + penalty flag per selected condition,
- **excess readmissions (count)** = `number_of_readmissions − expectedCount`,
  where `expectedCount = (expected_readmission_rate / 100) × number_of_discharges`,
  summed only over non-suppressed rows. This is built entirely from CMS-published
  fields — **no fabricated dollars.** (A dollar overlay may be added later ONLY
  as an explicitly cited, clearly-labeled illustration using a public average
  readmission cost — never presented as the hospital's actual savings.)
- a CDC PLACES county-prevalence overlay (demand context: CHD, COPD, diabetes,
  etc. for the hospital's county) — answers "is this a sick population or an
  under-performing program?"

Market rollup card: total excess readmissions across the market, count of
penalized hospitals, the worst N facilities, and the condition with the largest
aggregate excess. Drill into any hospital = the existing operator benchmark view.

## Data additions to the pipeline
Extend `scripts/build-snapshot.ts`:
1. Add `fetch-cdc-places` step (Socrata `swc5-untb`, CORS-open). Filter to
   HF-relevant measures (`CHD, COPD, DIABETES, BPHIGH, OBESITY, STROKE`), pin one
   `year` + `data_value_type=CrdPrv`. Key by `locationname` (county) + `stateabbr`.
2. Join into each hospital record via the already-stored `county`. Normalize
   county-name case (CMS `countyparish` is UPPER, PLACES is Title Case). Flag —
   don't drop — hospitals whose county fails to match, so coverage is auditable.
3. Add `prevalence: Partial<Record<PlacesMeasure, number>>` to `HospitalRecord`
   (and/or a per-state county→prevalence map in the shard to avoid duplication).

## Core (pure, reuses the pattern)
`src/lib/hrrp/market.ts`:
```
rankMarket(shard: HospitalRecord[], opts: {
  condition?: ConditionKey | "ALL";
  hospitalType?: string;
}): MarketResult
```
`MarketResult` = ranked `MarketRow[]` (hospital + per-condition ERR/penalty +
excessReadmissions + county prevalence) + a `MarketSummary` (totalExcess,
penalizedCount, reportedCount, worstFacilities, worstCondition). All aggregates
computed over non-suppressed rows only; suppressed cells surfaced, never imputed.

Add `excessReadmissions()` + `marketSummary()` helpers with unit tests
(including a fixture where some rows are suppressed, to prove they're excluded).

## View (`src/main.ts`)
Wire the "Map my market" door (currently `coming-soon`) to:
1. State picker (+ condition + type filters).
2. Summary card (total excess, penalized N/total, worst condition).
3. Ranked table: hospital · county · ERR(selected condition) · penalty · excess
   readmissions · county prevalence chip. Sortable; click row → operator verdict.
4. Export: market one-pager (CSV + copyable summary) for the analyst.

## Risks (carried from eng-plan + new)
- County join misses (case/spelling) → case-fold, flag unmatched, show coverage %.
- Suppression in rollups → sum/rank over non-suppressed only; label suppressed.
- Over-claiming opportunity → excess readmissions are CMS counts, not dollars or
  "avoidable" — copy must say so. No ROI claim without a contracted data feed.
- Multi-year PLACES rows → pin one year + CrdPrv in the snapshot.
- Bundle size → prevalence adds little; keep per-state shards.

## Definition of done
Market door live; pick a state → ranked, penalty-flagged, prevalence-overlaid
table with an honest market rollup; drill-through to the operator benchmark;
market one-pager export; tests on `rankMarket` + `excessReadmissions` including
suppression handling.
