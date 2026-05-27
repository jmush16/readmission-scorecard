# Engineering plan: recency + universal coverage (agent-spec'd, condensed)

Verified live 2026-05-27. Additive to the build-time-snapshot + pure-core pattern. No backend.

## Verified data
- **632h-zaca** Unplanned Hospital Visits (67,088 rows; 4,792 facilities). `score` for `READM_30_*` IS a percent rate (Winchester HF = 24.2). `Hybrid_HWR` = hospital-wide readmission rate, period **07/2023–06/2024** (4,211 facilities have a real score). `OP_35_ADM/ED` = **2024**. Fields incl. `denominator`, `number_of_patients`, `number_of_patients_returned`, `compared_to_national`, `start_date`/`end_date`, `footnote`. Suppression: `score = "Not Available"` / `"Number of Cases Too Small"`.
- **xubh-q36u** Hospital General Info (5,432 facilities) = **universal backbone**, strict superset of 632h-zaca, near-superset of HRRP (10 orphan CCNs). `hospital_overall_rating` (1–5 or "Not Available"), type, ownership, emergency_services, readm/mort/safety/ptexp group rollup counts.
- **9n3s-kdb3** HRRP — excess ratio + penalty (the lagged 2021–24 audit spine; unchanged).

## Coverage: build the universe from xubh-q36u (5,432, ~2× today). Three tiers at render:
- **A full:** HRRP + rates present → rate leads, excess ratio = "regulatory proof."
- **B partial:** HRRP suppressed but Hybrid_HWR / rating present (e.g. CAH 011300 still has Hybrid 14.9).
- **C backbone:** only xubh — star rating (or type/ownership/state context if rating "Not Available"). Never empty.

## Datasets to pull (3; keep lean): xubh-q36u (universe + rating + rollups), 632h-zaca (whitelist: Hybrid_HWR, READM_30_{HF,AMI,COPD,PN,HIP_KNEE,CABG}, OP_35_ADM, OP_35_ED), 9n3s-kdb3 (as today). Skip EDAC/OP_32/OP_36 + the 3 extra datasets for v1. Est ~6–8 MB total, shard <700 KB, one state loaded at a time.

## Data shape (additive): RateMeasure{id,score,comparedToNational,denominator,patients,returned,period,footnote}; OverallProfile{rating,ownership,emergencyServices,readm/mort/safety rollups}; HospitalRecord gains optional `overall` + `rates`. Manifest gains `measurePeriods`. benchmark.ts untouched (zero regression).

## Pure core: new `profile.ts` buildProfile(): headline (Hybrid_HWR → READM_30_HF → stars → type/ownership), recency ladder (measures sorted by end_date desc, each with its own "as of"), burden line (CMS's own `number_of_patients_returned` — factual count, no "avoidable" fabrication), state context, tier.

## Recency UX: per-figure "as of"; penalty/excess-ratio gets an amber "CMS penalty cycle — ~2-yr lag by law" chip (staleness = structural CMS fact, not tool defect). Thesis line: "fresh = where you are now; lagged = what it's costing you."

## Excavation arc: recency strip → hero (rate + state pervasiveness "X of Y penalized") → burden line (N patients returned) → penalty size → playbook → Research with AI → Contact.

## Contact form (static, no backend): a Contact button → modal (name/email/note + hidden hospital/tier), POST to Web3Forms (free, public access key tied to Joel's email, honeypot), mailto fallback on error. PostHog `contact_opened`/`contact_submitted` (CCN/state/tier only — NO name/email in analytics). MANUAL: Joel provides a Web3Forms access key.

## AI section: rename "Get what this data can't show" → "Research with AI", reposition as deeper/latest.

## Build order: types → normalize → profile + tests → build-snapshot (fetch 632h-zaca, universe from xubh, join) → run build:data → tiered web renderers + recency + burden + contact modal → rename AI panel → CLI --profile → build/test/deploy.

## Risks: bloat (whitelist + drop stored-suppressed + per-state shards + size assert); suppression (single num() source of truth); period mixing (per-measure period, never a global date); join drift (CCN clean, build from xubh, log orphans); Web3Forms token is public by design + honeypot + mailto fallback.
