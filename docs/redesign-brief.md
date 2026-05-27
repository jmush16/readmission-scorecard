# Redesign brief: make this tool actually useful

This is written in the founder's voice. It represents BOTH end users (the
frontline operator and the economic risk owner). Treat it as the standing
requirement the design and engineering work must satisfy.

## Honest diagnosis of what exists today (and why it fails)

The current tool (live at https://jmush16.github.io/follow-through-audit/) is a
**self-assessment quiz, not a tool.** The user answers ~10 questions about their
own workflow; we score those answers and hand the prose back with adjectives.

Why that is unacceptable:

- **No information enters the system.** The only "data" is the user's own
  self-report. The output is a deterministic restatement of their inputs.
- **It's circular.** An operator already knows their medication-access process
  is weak. Telling them "your medication access is weak" — because they told us
  — gives them nothing they walked in without.
- **The role toggle is cosmetic.** Both audiences see the same engine; we just
  hide different paragraphs. There is no genuinely different *product* per role.
- **The buttons are theater.** "Start audit" / "Generate pilot brief" don't
  produce a material artifact anyone would act on.
- It is pretty. Pretty is not the bar. The bar is **maximal benefit, easily
  understood** — and it leads each persona to a conclusion that makes sense.

## The bar

A useful tool brings the user information they **could not easily assemble
themselves**, about **their own reality**, and leads them — ontologically, step
by step — to a conclusion they can act on. It must be honest (public, non-PHI,
no fabricated savings). It is the reciprocity gift that opens the B2B
conversation: something that clearly took effort and is genuinely valuable.

## Verified real data (the raw material — confirmed live this session)

1. **CMS Hospital Readmissions Reduction Program (HRRP)** — provider-data API,
   dataset `9n3s-kdb3`. 18,330 rows. Every U.S. hospital, by `facility_id`
   (CCN) and `state`, for 6 conditions: `READM-30-HF-HRRP` (heart failure),
   AMI, COPD, PN (pneumonia), CABG, HIP-KNEE. Fields:
   `excess_readmission_ratio` (>1.0 = worse than expected = penalized),
   `predicted_readmission_rate`, `expected_readmission_rate`,
   `number_of_discharges`, `number_of_readmissions`, `start_date`, `end_date`.
   Query: `https://data.cms.gov/provider-data/api/1/datastore/query/9n3s-kdb3/0`
   - This is the gold: hospital-named, public, directly about readmissions, and
     the excess ratio / penalty status is a real, defensible, non-contestable
     number.
2. **CDC PLACES county data** — Socrata, resource `swc5-untb`. County-level
   chronic-disease prevalence (e.g. coronary heart disease, COPD, diabetes),
   `data_value`, `totalpopulation`, by `locationname` + `stateabbr`. Query:
   `https://data.cdc.gov/resource/swc5-untb.json`
3. **Companion CMS sets** worth evaluating: "Unplanned Hospital Visits -
   Hospital / State / National" (`632h-zaca`, `cvcs-xecj`, `4gkm-5ypv`) for
   benchmarks; the FY HRRP payment-adjustment file for actual penalty %; CMS
   Medicare Chronic Conditions / Geographic Variation PUF for per-capita spend.

## The two personas (use real titles — "operator" is too vague)

### Operator (feels the pain daily; amplifies; becomes our internal champion)
Real titles: Director of Care Transitions; Care Management / Care Coordination
Manager; Transitional Care RN; Readmission-Reduction Program Coordinator;
Inpatient/ED Case Management Lead.

**Job to be done:** "My team is drowning in post-discharge follow-up and I
suspect we're worse than we should be. I want to SEE how our hospital actually
performs vs. peers and quantify the gap, so I can walk into my director's office
with proof — CMS's data, not my opinion — that this needs resourcing."

**"Holy-shit-useful" output:** their own hospital's real numbers, ranked against
named peer hospitals in their state, the specific gap (in excess ratio, in
readmissions, in penalty exposure), across all 6 conditions, exportable as a
one-pager their boss cannot dismiss.

### Risk owner (owns the metric AND the budget — the BUYER)
Real titles: ACO Medical Director; Chief Medical Officer; VP / Director of
Population Health; VP Value-Based Care; Director of Medical Economics; Chief
Quality Officer; CFO.

**Job to be done:** "I'm deciding where to invest scarce care-management dollars
across my network/market. I want to see which facilities and conditions carry
the most excess readmissions and penalty exposure, so I can target the biggest,
most defensible opportunity instead of spreading thin."

**"Holy-shit-useful" output:** a ranked market/region opportunity map — hospitals
ranked by excess readmission + penalty status, layered with county prevalence
and Medicare spend context — that sizes the prize and names the targets.

Same public data. Genuinely different cut and conclusion. THAT justifies the
split: the data product differs, not just the prose.

## A starting concept to critique (NOT a mandate — tear it apart)

"HRRP Readmission Benchmark + Opportunity Map." Onboarding asks which job they're
here for (benchmark my hospital / map my market), phrased with the real titles.
- Operator → single-hospital benchmark: pick your hospital → its excess ratio
  per condition, rank among state peers, penalty flag, gap to median/best,
  3-year trend, export.
- Risk owner → market view: pick state/region + condition → all hospitals
  ranked by excess ratio + penalty, with county prevalence/spend overlay and
  opportunity sizing.
- The old workflow self-assessment survives only as an OPTIONAL second step
  ("why are we losing these patients?") AFTER the real data shows the gap.

## Hard constraints

- Public, non-PHI, redistributable data ONLY. No login. No PHI. No BAA/DUA.
- No fabricated savings / avoidable-readmission / patient-level ROI claims.
  Show CMS's published numbers and let the comparison speak.
- Keep it deployable as a static site (the data can be a build-time snapshot,
  refreshed by a scheduled job) OR justify a thin backend if truly required.
- AI-first: the same data/logic core must be reusable by a CLI / future MCP so
  agents can query it too.

## What I need back

1. Whether the starting concept actually clears the bar, or a better one.
2. For EACH persona: the exact flow, the screens, and the specific real-data
   artifact they leave with — drawn so I can see it leads them to a conclusion.
3. The honest answer to "would this person really use this?" with reasoning.
4. The engineering plan: data pipeline (live API vs build-time snapshot; CORS
   reality for CMS provider-data + Socrata), architecture, and the reuse core.
