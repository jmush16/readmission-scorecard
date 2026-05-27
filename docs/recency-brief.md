# Brief: recency + universal coverage (no hospital without data)

Founder mandate (full autonomy granted; do not complicate; complement what exists):

> "We are in the age of AI — there's no way we ship a tool that can't give operators
> valuable information. No hospital should go without data of some sort, and there must
> be a way of acquiring more recent data. This is an auditing tool, but operators can't
> use only 2-year-old data — it has to be recent in some way too."

And the framing that matters (Paolo's "excavation"):

> Operators live with the problem every day, but (a) they don't know the *solution*, and
> (b) they can't *contextualize how big it is*. The tool should make them feel: "I always
> knew about this problem — but I didn't know how pervasive it was, how much burden I
> carry, or how big the penalty is." Maximally beneficial → more inbounds → more users.

## What exists today (don't break it)
Live: a Readmission Reality Check. Verb gate (Benchmark my hospital / Map my market[soon]).
Operator picks a hospital → HRRP excess-ratio verdict across 6 conditions, penalty flags,
state-peer rank, evidence-based playbook + TCM billing, an AI research prompt, and a
copy/print one-pager. Static site (Vite + vanilla TS), pure core in `src/lib/hrrp/`,
build-time snapshot in `public/data/` (CMS has no CORS), CLI reuses the core.
Current weakness: HRRP is a single 2021–2024 period, and HRRP-suppressed hospitals
(small/critical-access/specialty, e.g. Rockville General) currently get a near-empty
readout. That is the problem to solve.

## Verified data (live-tested this session — design on THIS)
All CMS provider-data datasets; refreshed 2026-04-28 unless noted. No CORS → build-time
snapshot. Query base: `https://data.cms.gov/provider-data/api/1/datastore/query/{id}/0`.

- **632h-zaca — Unplanned Hospital Visits (67,088 rows). THE recency + coverage win.**
  Carries actual READMISSION RATES (e.g. `READM_30_HF` score = 20.1%, the raw rate, more
  intuitive than the excess ratio), `EDAC_30_*` (excess days in acute care), and crucially
  newer measures: `Hybrid_HWR` (hospital-wide readmission, period **07/2023–06/2024**),
  `OP_35_ADM`/`OP_35_ED` (period **01/2024–12/2024**), `OP_32`, `OP_36`. Fields incl.
  `measure_id`, `score`, `compared_to_national`, `denominator`, `number_of_patients`,
  `start_date`, `end_date`, `footnote`, plus facility/county.
- **xubh-q36u — Hospital General Information.** `hospital_overall_rating` (1–5 stars),
  hospital_type, ownership, county. Covers ~5,432 hospitals — the UNIVERSAL coverage
  backbone (most HRRP-suppressed hospitals still have a rating + type here).
- **9n3s-kdb3 — HRRP.** The excess ratio + penalty status (already integrated). Modified 2026-01-26.
- **ynj2-r877 — Complications and Deaths**, **dgck-syfz — HCAHPS patient survey**,
  **yv7e-xc69 — Timely and Effective Care.** All 2026-04-28; broad, widely-reported measures.

Implication: a hospital can be HRRP-suppressed yet still have an overall star rating,
patient-experience scores, complication/mortality measures, and 2024 outpatient measures.
**There is always something meaningful to show.**

## The thesis to spec
Evolve from a single-dataset (HRRP) tool into a **multi-source hospital profile** that:
1. **Guarantees coverage** — every hospital gets a useful readout: overall star rating +
   whatever measures aren't suppressed + state context. No dead-ends, ever.
2. **Maximizes recency** — prefer the freshest measures (Hybrid_HWR 2023–24, OP 2024),
   and label every figure with its measurement period ("as of …"). Be transparent that the
   penalty/excess-ratio is the lagged 2021–24 measure while other signals are newer.
3. **Keeps the live layer** — the AI research action for true today's-news/current penalty,
   reframed (see UX asks) so it COMPLEMENTS rather than implies our data is insufficient.
4. **Drives the excavation arc** — pervasiveness → personal burden → penalty size → solution.

## Specific UX asks from the founder
- **Contact:** the bottom "talk to Endurant" text link is unclear. Make it a **Contact
  button** that opens a **modal/popup** with name, email, optional note — NOT a mailto.
  (Static site: pick a no-backend form path, e.g. Formspree / Web3Forms / Tally, or a thin
  serverless endpoint — justify the choice; must stay non-PHI and low-friction.)
- **Reframe the AI section:** "Get what this data can't show" UNDERCUTS what we built.
  Rename to something simple like **"Research with AI"** — position it as going *deeper* /
  getting the very latest, not as compensating for a gap.
- Don't complicate the UI. Complement the existing verdict; keep the design language.

## What each agent should deliver
- **Engineering (gstack):** verify the remaining field/suppression details with curl;
  design the broadened snapshot (which datasets/measures to pull, normalized shape, "as of"
  per measure, how the profile guarantees coverage, recency selection logic), the pure-core
  changes, the contact-form mechanism (no backend), and a step-by-step build plan with
  risks. Keep it simple and additive. Write to `docs/recency-eng-plan.md`.
- **Design (gstack):** the verdict's information architecture so EVERY hospital (full data,
  partial, HRRP-suppressed) gets a compelling excavation readout; how recency/"as of" is
  shown without clutter; the Contact modal; the reframed "Research with AI" block. ASCII
  wireframes. Write to `docs/recency-design.md`.

Constraints: static + no backend (or minimal serverless if truly required), no PHI, no
fabricated savings/ROI, show CMS's published numbers with their dates, don't over-build.
