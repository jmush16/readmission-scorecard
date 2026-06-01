# The Post-Discharge Gap

A free, public, non-PHI CMS tool for care-transitions and value-based-care teams.
Search a hospital and get the part of the 30-day post-discharge picture that no
single dashboard assembles: the hospital's own readmission and HRRP penalty
exposure (the visible tip), and then **where its patients actually go next** — the
skilled-nursing and home-health settings nearby, and how often those settings send
patients right back to a hospital bed.

It is the lead magnet that opens a conversation. The contracted pilot runs the same
logic on attributed, compliant panel data — including the between-visit days that no
public dataset can see.

## What it shows

1. **The visible tip.** Freshest CMS readmission rate vs. national, the
   "how many patients came back" burden line, the fresher rate measures, and the
   HRRP excess-readmission ratios across all 6 conditions with state peer rank and
   penalty flags.
2. **The blind spots.**
   - **Cross-facility readmissions** — the published national pattern that ~1 in 4
     readmissions land at a *different* hospital, so a facility's own rate
     understates the true return rate (labeled as a national figure, never the
     hospital's own number).
   - **The post-acute landscape** — nearby SNFs' 30-day potentially-preventable
     rehospitalization (county-scoped, with the worst performers named) and
     statewide home-health PPH/PPR/DTC, each against the national reference.
3. **Why the gap stays open.** The structural argument: a transitional-care program
   is 2–3 snapshots across 30 days; the days between go unwatched. Continuous
   between-visit signal is the fix.
4. **Act on it.** An evidence-based intervention playbook + the TCM billing codes, a
   preset AI research prompt (seeded with the hospital's data), and a copy/print
   one-pager for leadership.

## What it never does

No login. No backend. No database. No PHI. No fabricated savings, avoidable-
readmission, or patient-level ROI claims. Public data frames the question; it never
pretends to identify patients or prove ROI.

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (HRRP benchmark, profile, post-acute core)
npm run build        # type-check + production build to dist/
npm run build:data   # re-pull the CMS snapshot into public/data/
```

## Use it from an AI agent (CLI)

The same pure core powers a CLI, so any coding agent can benchmark a hospital
locally — no account, no data leaves the machine:

```bash
npm run benchmark -- --name "winchester"       # search by name
npm run benchmark -- --id 220078               # exact CCN
npm run benchmark -- --name winchester --json  # machine-readable
npm run benchmark -- --id 220078 --profile     # full tier-aware readout
npm run benchmark -- --id 220078 --research    # the preset AI research prompt
```

## Architecture

No backend. A static Vite + TypeScript SPA over a committed CMS snapshot. The
domain logic lives in pure, typed modules so the web UI, the CLI, and any future
MCP server share one contract:

```
scripts/build-snapshot.ts   # fetch + normalize + join + shard CMS data -> public/data/
src/lib/hrrp/types.ts       # the shared contract (hospital + post-acute)
src/lib/hrrp/normalize.ts   # CMS suppression handling, medians, verdict parsing
src/lib/hrrp/benchmark.ts   # HRRP excess-ratio benchmarking vs state peers
src/lib/hrrp/profile.ts     # tier-aware hospital readout (full / partial / backbone)
src/lib/hrrp/postacute.ts   # SNF (county) + Home Health (state) aggregation + resolve
src/lib/hrrp/playbook.ts    # evidence-based interventions + TCM billing
src/lib/hrrp/research.ts    # the preset AI research prompt
src/main.ts                 # web UI (search -> the post-discharge-gap readout)
cli/benchmark.ts            # CLI surface (reuses the same core)
public/data/                # manifest + per-state hospital shards + postacute shards
```

## Data

All public CMS provider-data, non-PHI, committed and diffable:

| Dataset | ID | Used for |
|---|---|---|
| Hospital General Information | `xubh-q36u` | the hospital universe + overall rating |
| Hospital Readmissions Reduction Program | `9n3s-kdb3` | excess ratios + penalty (lagged ~2yr) |
| Unplanned Hospital Visits | `632h-zaca` | fresher readmission rate measures |
| SNF Quality Reporting | `fykj-qjee` | SNF 30-day rehospitalization + discharge-to-community (county-scoped) |
| Home Health agency data | `6jpm-sxkc` | home-health PPH / PPR / DTC (state-scoped) |
| Home Health national | `97z8-de96` | national reference rates |

`.github/workflows/refresh-data.yml` re-pulls monthly and opens a PR so every data
change is reviewable before it ships.

> **Honesty rules baked in:** every figure is dated to its own measurement window;
> suppressed cells are excluded from medians and ranks (never imputed); the
> cross-facility stat is a national pattern, not the hospital's number; and the SNF
> "national" reference is the median of reporting SNFs (CMS publishes no SNF national
> rate), labeled as such.
