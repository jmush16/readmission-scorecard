# Design review: making the Follow-Through tool genuinely useful

Author: Design + Product lead (acting in the founder's place)
Date: 2026-05-27
Status: Recommendation — supersedes the current quiz implementation

---

## TL;DR

The current tool is a self-assessment quiz that hands the user's own answers back
with adjectives. It must be cut, not patched. **No information enters the system,
so no information can leave it.** That is the entire problem and no amount of copy
fixes it.

The starting concept — **HRRP Readmission Benchmark + Opportunity Map** — clears
the bar, because for the first time real information enters the system: the user's
own hospital's published CMS readmission performance, which they did *not* walk in
holding in a comparable, ranked form. I am keeping the concept and sharpening it.
I am renaming it and restructuring both flows so each persona reaches a conclusion
that makes sense, step by step.

The single most important design decision: **the user types nothing about
themselves except their hospital (operator) or their state/market (risk owner).
Everything else is real CMS data we already have.** The old quiz inverted this —
it asked the user to supply the substance. We supply the substance now.

I verified both data sources live this session (see Appendix A). One hard
engineering constraint emerged that shapes the whole architecture: **CMS
provider-data returns NO CORS header, so it cannot be fetched from the browser on
a static site.** It must be a build-time snapshot. CDC PLACES is CORS-open
(`Access-Control-Allow-Origin: *`) and can be queried live. This is convenient,
not limiting — HRRP refreshes about once a year.

---

## 1. Does the starting concept clear the bar?

### The bar (restated from the brief)
> Bring the user information they could not easily assemble themselves, about
> their own reality, and lead them step by step to a conclusion they can act on.
> Honest, public, non-PHI, no fabricated savings.

### Verdict: YES — with three sharpenings.

The reason it clears the bar where the quiz failed is structural, not cosmetic.
Compare the information flow:

| | Old quiz | This tool |
|---|---|---|
| What enters the system | The user's self-report | The user's identity (hospital/state) |
| What we add | Nothing (we re-score their words) | Every US hospital's CMS performance, pre-computed peer ranks, penalty status |
| What leaves | A restatement of inputs | A number about *them* they didn't have, positioned against named peers |
| Could they get this in 5 min themselves? | They already had it (it's their opinion) | No — CMS publishes a flat 18,330-row file with no peer ranking, no per-state percentile, no condition rollup |

That last row is the whole game. The CMS HRRP file is *public* but it is not
*usable*. It is one giant CSV where you are row 9,412, your excess ratio sits next
to a hospital in another state with a different condition, and nothing tells you
where you rank. **The value we create is not the data — it's the assembly:
filtering to the user's reality, ranking against true peers, rolling up six
conditions, flagging penalty exposure.** That is real work the user cannot
trivially do, about their own reality. Reciprocity gift confirmed.

This also satisfies the strongest behavioral-design principle for a lead magnet:
the **endowment / "IKEA" effect is the wrong lever for B2B trust; the right lever
is the "aha" of self-relevant comparison.** People act on information that is
(a) about them specifically and (b) socially/competitively framed (where do I
rank?). Decades of benchmarking-feedback research — from energy "compared to your
neighbors" home reports (Allcott 2011, *J. Public Economics*) to clinical
performance feedback (Ivers et al., Cochrane review of audit & feedback, 2012) —
show that *comparative* feedback against named/relevant peers changes behavior far
more than absolute scores or self-report. The old quiz gave an absolute,
self-generated score. This gives a comparative, externally-sourced rank. That is
the difference between theater and a tool.

### Sharpening 1 — Rename it. "Audit" is wrong.
"Readiness Audit" promises a judgment of *them*; it set the expectation that we'd
grade their workflow, which is exactly the circular trap. The honest name
describes what the data *is*:

> **Readmission Reality Check** — *Your hospital's CMS readmission performance,
> ranked against your real peers. Public data, assembled.*

The subtitle does the credibility work: "CMS data, assembled" signals effort + we
didn't invent anything. (Nielsen Norman Group on the 50ms credibility judgment,
Lindgaard et al. 2006 — the first line must say what it honestly is.)

### Sharpening 2 — Lead with the number, not the form.
The old tool buried the result behind a 7-field form. **Reverse it.** The user
picks one thing (their hospital, or their state) and the conclusion appears
immediately. Then we let them go deeper. This respects the F-pattern and front-
loads the payoff: the highest-attention real estate (top-left, first screen) must
carry the most self-relevant fact, which is *their excess ratio and rank*, not a
questionnaire. Progressive disclosure (Hick's Law) — one choice in, payoff out,
optional depth after.

### Sharpening 3 — The six conditions are a feature, not a footnote.
HF is Endurant's wedge, but the file carries AMI, COPD, PN, CABG, HIP-KNEE too.
For the operator this multiplies the "holy shit" (you're penalized on 4 of 6).
For the risk owner it *is* the product (where is my biggest, most defensible
prize across conditions × facilities). Both flows must show all six and let HF be
the highlighted default, not the only lens.

---

## 2. The two personas: flow, screens, and the artifact each leaves with

### Onboarding (shared) — the routing question

The landing must make them self-select by **what they came to do**, phrased in
their real title's language, not the vague word "operator." One screen, one
question, two doors. (Jakob's Law: a "choose your path" router is a familiar,
low-cognitive-load pattern; do not get clever here.)

```
┌──────────────────────────────────────────────────────────────────────┐
│  READMISSION REALITY CHECK                                             │
│  Your hospital's CMS readmission performance, ranked against peers.    │
│  Public CMS data (HRRP, FY2025), assembled. No login. No PHI.          │
│                                                                        │
│   What did you come to do?                                             │
│                                                                        │
│   ┌────────────────────────────────┐  ┌──────────────────────────────┐│
│   │  ▸ BENCHMARK MY HOSPITAL        │  │  ▸ MAP MY MARKET             ││
│   │                                 │  │                              ││
│   │  See how one hospital performs  │  │  Rank every hospital in a    ││
│   │  vs. its state peers, across    │  │  state/region by readmission ││
│   │  all 6 conditions. Leave with   │  │  + penalty exposure. Find the││
│   │  a one-pager for your director. │  │  biggest opportunity.        ││
│   │                                 │  │                              ││
│   │  For: Care Transitions Director │  │  For: ACO Medical Director,  ││
│   │  · Care Management Manager ·    │  │  CMO · VP Population Health · ││
│   │  Readmission Program Coord. ·   │  │  VP Value-Based Care ·       ││
│   │  Transitional Care RN · Case    │  │  Dir. Medical Economics ·    ││
│   │  Management Lead                │  │  Chief Quality Officer · CFO ││
│   └────────────────────────────────┘  └──────────────────────────────┘│
│                                                                        │
│   Not sure? Most frontline & nursing roles pick the left. Most         │
│   medical-director, quality, and finance roles pick the right.         │
└──────────────────────────────────────────────────────────────────────┘
```

**The routing question is:** *"What did you come to do — benchmark my hospital, or
map my market?"* Job-to-be-done, not job-title, because a CMO might want the
single-hospital view and a coordinator might be curious about the market. The real
titles live as the "For:" line under each door so people recognize themselves
(recognition over recall), but the *verb* routes them. This is more robust than a
title dropdown, which forces a taxonomy fight ("am I 'Care Management' or 'Care
Coordination'?") that adds friction with no payoff.

Design note: keep both doors equally weighted visually. The buyer is who we want,
but the operator is the internal champion who *forwards* the artifact to the buyer.
Do not down-rank the operator door.

---

### PERSONA A — The Operator: "Benchmark my hospital"

**Real titles:** Director of Care Transitions; Care Management / Care Coordination
Manager; Transitional Care RN; Readmission-Reduction Program Coordinator;
Inpatient/ED Case Management Lead.

**Job to be done:** "I suspect we're worse than we should be. Show me our real
numbers vs. named peers so I can walk into my director's office with CMS's data,
not my opinion, and get this resourced."

**The artifact they leave with:** a one-page, exportable brief — *their* hospital's
excess ratio per condition, penalty flag, rank among state peers, gap to the state
median and to the best-in-state, and the named hospitals above/below them — that
their director cannot wave away because it is CMS's published number, not a vendor
claim.

#### Flow

```
ROUTER ─▶ [Step 1: pick hospital] ─▶ [Step 2: the verdict screen] ─▶
         (typeahead, 1 field)        (the payoff, instant)
                                          │
                                          ├─▶ [Condition detail drill-down]
                                          ├─▶ [Peer table: who's above/below me]
                                          └─▶ [Export one-pager / "Why?" step (optional)]
```

#### Step 1 — One field. Typeahead on real facility names.

```
┌──────────────────────────────────────────────────────────────────────┐
│  ‹ back                                    BENCHMARK MY HOSPITAL        │
│                                                                        │
│   Find your hospital                                                   │
│   ┌──────────────────────────────────────────────────────────┐        │
│   │ 🔍 winchester hosp|                                        │        │
│   └──────────────────────────────────────────────────────────┘        │
│      WINCHESTER HOSPITAL — Winchester, MA  (CCN 220078)                 │
│      WINCHESTER MEDICAL CENTER — Winchester, VA (CCN 490063)            │
│                                                                        │
│   We'll compare you to the other 50 hospitals in your state that       │
│   report heart-failure readmissions to CMS.                            │
└──────────────────────────────────────────────────────────────────────┘
```

Only input the operator gives. No self-report. Typeahead over the snapshot's
`facility_name` + `state` + `facility_id`.

#### Step 2 — The verdict screen (the "holy shit" moment, above the fold)

This is the screen that has to land in the first 3 seconds. Lead with HF (the
wedge), show the rank, show the penalty flag, show the named gap.

```
┌──────────────────────────────────────────────────────────────────────┐
│  WINCHESTER HOSPITAL · Winchester, MA · CCN 220078                     │
│  CMS HRRP · discharges 07/2021–06/2024 · FY2025 program year           │
│ ──────────────────────────────────────────────────────────────────── │
│                                                                        │
│   HEART FAILURE (READM-30-HF)                                          │
│                                                                        │
│     Excess Readmission Ratio        ┌─────────────────────────────┐    │
│          1.23                       │ 🔴 PENALIZED                │    │
│     ▲ 23% MORE readmissions than    │ Ratio > 1.0 = CMS expects   │    │
│       CMS expects for your case mix │ fewer. You exceed it.       │    │
│                                     └─────────────────────────────┘    │
│                                                                        │
│   Your rank in Massachusetts (heart failure):                          │
│                                                                        │
│     ███████████████████████████████████████████████░  #1 of 51        │
│     ▲ You have the HIGHEST excess readmission ratio in your state.     │
│                                                                        │
│     State median ERR: 1.045   ·   Best in state: 0.876 (──────)        │
│     Your gap to the state median: +0.185                               │
│                                                                        │
│   Predicted 30-day readmit rate: 24.1%  ·  Expected: 19.6%             │
│   Discharges in window: 685   ·   Readmissions: 172                    │
│                                                                        │
│   [ See all 6 conditions ▾ ]   [ Who ranks above & below me ▾ ]        │
│   [ Export one-page brief ]    [ Why is this happening? (optional) ]   │
└──────────────────────────────────────────────────────────────────────┘
```

Every number on this screen is a real CMS field (Appendix A confirms Winchester =
1.23 ERR, 685 discharges, 172 readmissions, MA median 1.045, 35/51 penalized). The
"23% more than expected" is just `(ERR − 1) × 100` — a true restatement of the
ratio, **not** a fabricated savings or avoidable-readmission claim. We never
multiply by a dollar figure. We let CMS's number speak.

Honesty guardrails baked into this screen:
- If `number_of_discharges` is `"N/A"` or readmissions `"Too Few to Report"` (both
  real values in the data), we show **"CMS suppressed this — too few cases to
  report reliably"** instead of inventing a rank. Roughly a third of facility ×
  condition cells are suppressed; the UI must handle it as a first-class state, not
  a crash.
- The window dates (07/2021–06/2024) are shown so no one thinks this is live.

#### Step 2b — All six conditions (one click down)

```
┌──────────────────────────────────────────────────────────────────────┐
│  WINCHESTER HOSPITAL — all conditions                                  │
│ ──────────────────────────────────────────────────────────────────── │
│  Condition            ERR     vs expected   Penalty   Rank in MA       │
│  ───────────────────  ──────  ───────────   ───────   ───────────      │
│  Heart failure (HF)   1.230   +23%          🔴 yes    #1 / 51          │
│  Pneumonia (PN)       1.118   +12%          🔴 yes    #4 / 49          │
│  COPD                 1.071   +7%           🔴 yes    #6 / 38          │
│  Heart attack (AMI)   0.984   −2%           🟢 no     #19 / 31         │
│  Hip/Knee             0.951   −5%           🟢 no     #28 / 44         │
│  CABG                 — CMS suppressed (too few cases) —                │
│ ──────────────────────────────────────────────────────────────────── │
│  You are penalized on 3 of the 5 conditions CMS could score for you.   │
│  Heart failure is your single worst standing — and the one with the    │
│  most discharges to act on.                                            │
└──────────────────────────────────────────────────────────────────────┘
```

This is the line that gets forwarded: *"penalized on 3 of 5, worst on HF."* It
turns a vague worry into a specific, sourced, multi-condition fact.

#### Step 2c — The peer table (who's above & below me)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Heart failure — Massachusetts, ranked worst → best (ERR)              │
│ ──────────────────────────────────────────────────────────────────── │
│   #1   ▶ WINCHESTER HOSPITAL              1.230   🔴   ← you            │
│   #2     MILFORD REGIONAL MEDICAL CTR     1.214   🔴                   │
│   #3     COOLEY DICKINSON HOSPITAL        1.140   🔴                   │
│   ...                                                                  │
│   #26    [STATE MEDIAN LINE] ............ 1.045                        │
│   ...                                                                  │
│   #51    BEST IN STATE (named)            0.876   🟢                   │
│ ──────────────────────────────────────────────────────────────────── │
│  Showing you by name is the point: this is CMS's published comparison, │
│  not our opinion.                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

Named peers (left-aligned, respecting left-side attention bias) are what make this
undismissable. "We're #1 worst of 51, and here are the three hospitals just below
us" is a sentence a director cannot argue with.

#### The export — the actual deliverable

One-page, print-ready (CSS `@media print`), self-contained, with the CMS citation
and window dates in the footer. Headline auto-written from the data:

> **Winchester Hospital ranks worst in Massachusetts for heart-failure
> readmissions (CMS HRRP, FY2025).** Excess readmission ratio 1.23 — 23% above
> CMS's expectation for our case mix — placing us #1 of 51 reporting hospitals and
> +0.185 above the state median. We are penalized on 3 of 5 scored conditions.
> Source: CMS Hospital Readmissions Reduction Program, dataset 9n3s-kdb3,
> discharges 07/2021–06/2024.

Plus a CTA that is NOT a hard sell: *"Want to see why these patients come back —
and what a follow-through pilot would target? → talk to Endurant."*

#### Would the operator REALLY use this? — Honest answer: **Yes.**

This maps exactly onto the job-to-be-done. A care-transitions director's hardest
problem is not knowing they have a problem — it's *getting it resourced*. Their
boss discounts their opinion as "the nurse wants more nurses." This tool converts
their gut feeling into **CMS's number, with their hospital named, ranked against
named local competitors.** That is precisely the ammunition the JTBD asks for. The
effort to produce it themselves (download an 18k-row CSV, filter, rank, compute
percentiles, roll up six conditions) is real and most won't do it — which is why
the assembled version is a genuine gift. I'm confident this gets forwarded
internally, which is the whole champion-amplification thesis.

The one risk: a hospital that performs *well* (ERR < 1.0) gets a less dramatic
moment. That's fine and honest — the export still says "we're better than the state
median, here's proof," which is also useful upward ammunition (defend the budget
that got us here). We don't manufacture alarm.

---

### PERSONA B — The Risk Owner / Buyer: "Map my market"

**Real titles:** ACO Medical Director; Chief Medical Officer; VP / Director of
Population Health; VP Value-Based Care; Director of Medical Economics; Chief
Quality Officer; CFO.

**Job to be done:** "I'm deciding where to put scarce care-management dollars
across my network/market. Show me which facilities and conditions carry the most
excess readmissions and penalty exposure, so I target the biggest, most defensible
opportunity instead of spreading thin."

**The artifact they leave with:** a ranked market opportunity map — every hospital
in their state/region, sorted by a defensible composite of excess readmissions and
penalty exposure, sliced by condition, with county chronic-disease prevalence
(CDC PLACES) as demand context — that sizes the prize and *names the targets*,
exportable for an investment committee.

#### Flow

```
ROUTER ─▶ [Step 1: pick state/region + condition] ─▶ [Step 2: the market map] ─▶
         (2 fields, real defaults)                    (ranked table + sizing)
                                                          │
                                                          ├─▶ [Condition switcher]
                                                          ├─▶ [County prevalence overlay]
                                                          ├─▶ [Drill into one facility = Operator view]
                                                          └─▶ [Export market brief]
```

#### Step 1 — Two fields. State + condition. Sensible defaults (MA, HF).

```
┌──────────────────────────────────────────────────────────────────────┐
│  ‹ back                                            MAP MY MARKET       │
│                                                                        │
│   Where do you operate?      Which condition?                          │
│   ┌──────────────────┐       ┌──────────────────────────────┐         │
│   │ Massachusetts  ▾ │       │ Heart failure          ▾     │         │
│   └──────────────────┘       └──────────────────────────────┘         │
│                              (HF · AMI · COPD · Pneumonia · CABG ·     │
│                               Hip/Knee · or "All conditions")          │
│                                                                        │
│   We'll rank every reporting hospital in your state by excess          │
│   readmissions and CMS penalty exposure, then layer county chronic-    │
│   disease prevalence as demand context.                                │
└──────────────────────────────────────────────────────────────────────┘
```

(Multi-state "region" is a v2 nicety; single-state covers the ACO/market case and
matches how the data filters cleanly. Don't block v1 on region rollups.)

#### Step 2 — The market opportunity map (the payoff)

```
┌──────────────────────────────────────────────────────────────────────┐
│  MASSACHUSETTS · HEART FAILURE · CMS HRRP FY2025                       │
│ ──────────────────────────────────────────────────────────────────── │
│   51 hospitals report HF.  35 are penalized (ERR > 1.0).               │
│   State median ERR 1.045.  Worst: Winchester (1.23). Best: ___ (0.88). │
│                                                                        │
│  Ranked opportunity (worst excess ratio → best):                       │
│                                                                        │
│  Hospital                  ERR    Disch  Readm  Penalty  Opp. signal   │
│  ────────────────────────  ─────  ─────  ─────  ───────  ───────────   │
│  WINCHESTER HOSPITAL        1.230   685    172    🔴      ███████ high  │
│  CAPE COD HOSPITAL          1.115  1188    247    🔴      ███████ high  │  ← high volume
│  GOOD SAMARITAN MED CTR     1.119   682    158    🔴      ██████  high  │
│  MILFORD REGIONAL           1.214   733    180    🔴      ██████  high  │
│  STURDY MEMORIAL            1.124   416     97    🔴      ████    med   │
│  ...                                                                   │
│  ────────────────────────────────────────────────────────────────────│
│  Opportunity signal = excess readmissions above expectation, weighted  │
│  by discharge volume. NOT a savings claim — it's where the most        │
│  above-expected readmissions concentrate. Formula shown on hover.      │
│                                                                        │
│  [ Switch condition ▾ ]  [ Add county prevalence ▾ ]  [ Export brief ] │
└──────────────────────────────────────────────────────────────────────┘
```

Why "opportunity signal" and not "savings": the brief forbids fabricated savings.
So the defensible composite is built **only from CMS's own published numbers**:

> **Excess readmissions (count) ≈ number_of_readmissions × (1 − 1/ERR)**, i.e. how
> many of the actual readmissions are *above* what CMS expected for that hospital's
> case mix.

This is arithmetic on published fields, not a modeled dollar value. It correctly
surfaces that a high-volume hospital at ERR 1.12 (Cape Cod, 1188 discharges) may be
a *bigger* prize than a small one at ERR 1.23 — which is exactly the targeting
insight a risk owner needs and cannot get from the raw ranked-by-ratio list. We
label it "signal," show the formula on hover, and never attach a dollar sign. (If
later you license the FY payment-adjustment file or a per-capita spend PUF, *then*
you can responsibly attach penalty-dollar exposure — note that as a v2 upgrade,
gated behind real data.)

#### Step 2b — County prevalence overlay (CDC PLACES, fetched live)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Demand context — heart-disease & related prevalence (CDC PLACES)      │
│ ──────────────────────────────────────────────────────────────────── │
│  County (MA)        CHD prev.  COPD prev.  Pop 18+    Note             │
│  ─────────────────  ─────────  ──────────  ────────   ─────────────    │
│  Middlesex          5.8%       5.1%        1.2M       Winchester here  │
│  Barnstable         7.1%       7.9%        185k       Cape Cod here    │
│  ...                                                                   │
│  Higher county prevalence + high hospital excess ratio = where         │
│  follow-through investment compounds. (Context only — CDC is county-   │
│  level, CMS is hospital-level; we don't claim causation.)              │
└──────────────────────────────────────────────────────────────────────┘
```

Honest framing: county prevalence is *context for demand*, not a claim that county
X causes hospital Y's readmissions. The copy says so explicitly. This is the layer
that makes the risk owner feel they're seeing the market, not just a leaderboard.

#### Step 2c — Drill into any facility = the operator's single-hospital view

The risk owner clicks any row and lands on Persona A's verdict screen for that
hospital. **One data core, two entry points.** This is also how the buyer validates
a target before a conversation: "show me Winchester's full card."

#### The export — the market brief

One page (or 2), print-ready, for an investment/quality committee:

> **Heart-failure readmission opportunity — Massachusetts (CMS HRRP FY2025).** 35
> of 51 reporting hospitals are penalized. The largest concentration of
> above-expected HF readmissions sits at [top 5 named hospitals], which together
> account for ~N excess readmissions above CMS expectation. State median ERR 1.045.
> Targeting the top 5 by volume-weighted excess covers X% of the state's
> above-expected HF readmissions. Source: CMS HRRP 9n3s-kdb3; demand context CDC
> PLACES swc5-untb.

#### Would the risk owner REALLY use this? — Honest answer: **Yes, with one caveat.**

The JTBD is a *targeting/allocation* decision, and this is a targeting tool. It
answers "which facilities and conditions, ranked, named, defensible" directly. The
volume-weighted excess composite is the genuinely non-trivial assembly — a CMO
*cannot* eyeball that from the CSV, and it changes the answer (volume beats ratio).
That's the "could not assemble themselves" test, passed.

**Caveat (be honest):** a risk owner who already lives in their own EHR/claims
dashboards may find the *absolute* numbers familiar for their own facilities. The
defensible edge is the **cross-facility, externally-benchmarked, penalty-framed
market view** — they rarely have their *competitors* ranked next to them on a
neutral public source. So the copy must lean into "your market, externally
benchmarked," not "your numbers" (which they have). If we framed it as "here's your
readmission rate," that would drift back toward the mirror problem for this
persona. Framed as "here's your whole market ranked, you named and your
competitors named," it's net-new and useful.

---

## 3. The old workflow self-assessment: keep as a secondary "Why?", or cut?

**Recommendation: keep it, but demote it hard — and only on the operator path.**

The quiz's fatal flaw was being the *whole product* and the *entry point*. As a
*secondary* step it has a legitimate, non-circular job: **once the data has proven
the gap exists, the workflow questions help the user form a hypothesis about
*why*.** That sequence is no longer a mirror, because the gap is now an externally
established fact, and the questions become diagnostic rather than self-fulfilling.

Placement: it appears only as the optional **"Why is this happening?"** button on
the operator's verdict screen, *after* the data. Re-scoped so it does NOT produce a
fake "readiness score" (that's the part that was theater). Instead it produces a
short, honest **"likely failure points"** narrative tied to the conditions they're
actually penalized on, leading to the pilot conversation:

```
┌──────────────────────────────────────────────────────────────────────┐
│  WHY these patients come back (optional, 6 quick questions)            │
│  You're penalized on heart failure. The data shows the WHAT. These     │
│  questions help you and us name the likely WHERE in your workflow.     │
│ ──────────────────────────────────────────────────────────────────── │
│  …6 workflow questions (meds access, 48–72h contact, teach-back,       │
│   escalation owner, closed-loop proof, navigator capacity)…            │
│ ──────────────────────────────────────────────────────────────────── │
│  Output: "Given your gap is worst on HF and PN, and you flagged        │
│  medication access as untracked and no single escalation owner, the    │
│  two highest-yield places to start are X and Y." → pilot conversation. │
└──────────────────────────────────────────────────────────────────────┘
```

Key change: the output references the **real data gap** ("worst on HF and PN")
*plus* their answers, so it's additive, not circular. Drop the 0–100 readiness ring
entirely — it was the most mirror-like element. If engineering time is tight, **cut
the quiz from v1 and ship the data tool alone.** The data tool is the gift; the quiz
is a conversation-opener that can come in v1.1. Do not let the quiz block the launch
of the thing that actually clears the bar.

For the risk-owner path: **cut the quiz entirely.** A CMO won't fill out a
front-line workflow survey; their next step is "drill into a target / export the
market brief / talk to us," not introspection about navigator capacity.

---

## 4. Onboarding role labels and the routing question (consolidated)

**Routing question (single):** *"What did you come to do?"*

**Two doors, by verb (JTBD), with real titles as recognition cues:**

| Door | Verb label | Real titles shown underneath |
|---|---|---|
| Left | **Benchmark my hospital** | Director of Care Transitions · Care Management / Coordination Manager · Readmission-Reduction Program Coordinator · Transitional Care RN · Case Management Lead |
| Right | **Map my market** | ACO Medical Director · Chief Medical Officer · VP/Dir. Population Health · VP Value-Based Care · Director of Medical Economics · Chief Quality Officer · CFO |

Why verb-first beats a title dropdown: titles in this space are inconsistent across
systems (one org's "Care Coordination Manager" is another's "Transitional Care
Lead"), so a dropdown forces a taxonomy the user has to map themselves onto —
friction with no payoff. The verb is unambiguous and the titles serve as
"that's me" recognition (recognition over recall). A non-blocking helper line
handles the unsure. Both doors equally weighted so we don't repel the
champion-operator who forwards to the buyer.

---

## 5. Engineering plan (data, architecture, reuse core)

### Data pipeline — the decisive CORS finding

I tested CORS headers live this session:

- **CMS provider-data (HRRP 9n3s-kdb3): NO `Access-Control-Allow-Origin` header.**
  A browser on a static site (github.io) **cannot** fetch this directly — it will
  be blocked by the same-origin policy. → **Must be a build-time snapshot.**
- **CDC PLACES (Socrata swc5-untb): `Access-Control-Allow-Origin: *`.** Can be
  fetched live from the browser, or also snapshotted.

This actually simplifies the architecture and is honest about freshness: HRRP is a
once-a-year publication (current window 07/2021–06/2024), so a snapshot is not a
compromise — live fetching would be pointless churn.

**Recommended architecture (static site, no backend required):**

1. **Build-time fetch script** (`scripts/fetch-hrrp.ts`, run in CI on a schedule,
   e.g. monthly cron via GitHub Actions): page through all 18,330 HRRP rows
   (limit/offset, ~10 requests), normalize, drop suppressed cells to a clear flag,
   and emit a compact static JSON the site ships with. Pre-compute per-state,
   per-condition **ranks, medians, best/worst, penalty counts, and volume-weighted
   excess** at build time so the browser does zero heavy math. Output ~ a few
   hundred KB gzipped; shard by state if needed (`data/hrrp/MA.json`).
2. **CDC PLACES**: either snapshot the same way (preferred for determinism) or
   fetch live by `stateabbr` (CORS allows it). Snapshot is safer — avoids a
   third-party outage breaking the page.
3. **Static hosting unchanged** (GitHub Pages). No login, no PHI, no backend, no
   BAA/DUA — fully satisfies the hard constraints.

If you later license the FY payment-adjustment file or a spend PUF (for real
penalty-dollar exposure), the same build script ingests it; the *site* doesn't
change shape.

### The reuse core (AI-first requirement)

Mirror the good instinct already in the repo (the extracted `scoring.ts`): put all
data logic in a **pure, dependency-free core** that the web UI, a CLI, and a future
MCP server all import. Nothing about ranking/sizing should live in DOM code.

```
src/core/                      ← pure functions, no DOM, no fetch
  hrrp.ts        loadSnapshot(), getFacility(ccn), rankInState(state, measure)
  market.ts      marketMap(state, measure) -> ranked rows + sizing
  excess.ts      excessReadmissions(readm, err), volumeWeightedExcess(...)
  places.ts      countyPrevalence(state)
  suppression.ts isSuppressed(row), reasons  ← handles "N/A"/"Too Few to Report"
  format.ts      "+23% above expected" etc. (the honest restatements)

src/web/         imports core, renders the two flows
cli/             `reality-check benchmark --ccn 220078`
                 `reality-check market --state MA --measure HF`
mcp/  (later)    same core, exposed as tools: benchmark_hospital, map_market
```

The CLI/MCP returning the *same* artifact the UI shows is what makes this
"AI-first": an agent can call `map_market(MA, HF)` and get the exact ranked,
sized, sourced object the human sees. Keep the artifact a serializable object the
UI merely renders.

### What to delete from the current repo
- The entire scoring quiz as the primary engine (`data/questions.ts`,
  `data/failureMap.ts`, the readiness-ring rendering, `roleViews.ts` prose).
- Re-purpose the *visual* shell (`styles.css` — keep it, it's good and on-brand),
  the role-gate pattern, the export/copy plumbing, and the pure-core discipline.

---

## Appendix A — Live data verification (this session)

All confirmed against the live APIs on 2026-05-27:

- **HRRP 9n3s-kdb3**: 18,330 rows. Fields exactly as the brief states
  (`facility_name`, `facility_id`, `state`, `measure_name`,
  `excess_readmission_ratio`, `predicted_readmission_rate`,
  `expected_readmission_rate`, `number_of_discharges`, `number_of_readmissions`,
  `start_date` 07/01/2021, `end_date` 06/30/2024). Six measures confirmed:
  READM-30-{HF, AMI, COPD, PN, CABG, HIP-KNEE}-HRRP.
- **Real values used in the wireframes are real**: MA heart failure — Winchester
  Hospital ERR 1.23 (685 discharges, 172 readmissions), Milford Regional 1.214,
  Cooley Dickinson 1.140, Cape Cod 1.115 (1188 discharges), state median ERR 1.045,
  35 of 51 reporting hospitals penalized.
- **Suppression is real and common**: `number_of_discharges` = "N/A" and
  `number_of_readmissions` = "Too Few to Report" appear frequently. The UI must
  treat suppression as a first-class state.
- **CDC PLACES swc5-untb**: live, CORS-open, county-level prevalence with
  `data_value`, `totalpopulation`, `locationname`, `stateabbr`.
- **CORS**: CMS provider-data returns no `Access-Control-Allow-Origin` →
  build-time snapshot required. CDC returns `*` → live-fetch-capable.
