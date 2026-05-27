# Design: recency + universal coverage (the excavation readout)

Design lead deliverable for the Readmission Reality Check. This extends the existing
design language (`src/styles.css`, `src/benchmark.css`) — it does **not** redesign it.
Everything below reuses tokens that already exist: `--radius`, `--blue/-deep`, `--green`,
`--rose`, `--amber`, `--surface-*`, `.hero`, `.cond`, `.panel`, `.badge`, `.pill`, `.tag`,
`.score-ring`, `.summary-list`, `.data-row`. New work = a small number of additive classes,
listed at the end.

The founder mandate, restated as design constraints:
1. **No dead-ends.** Every hospital — full HRRP, partial, or HRRP-suppressed — gets a
   readout that feels complete and on-brand.
2. **Feel recent.** Every figure carries its own measurement period; the lagged penalty is
   visibly framed as one (older) signal among fresher ones, never as "the data."
3. **Drive the excavation.** Layout sequences the operator from *"I know this"* →
   *"I didn't know it was THIS big / costing THIS much."*
4. **Don't complicate.** Complement the verdict. No new screen, no new navigation.

---

## 0. The spine: one verdict, three tiers, one reading order

The current verdict already reads top-to-bottom. We keep that. The change is that the
**lead unit adapts to coverage tier**, and a **recency strip** + an **excavation rail**
are threaded through all three tiers so the *arc* is identical even when the *data* isn't.

Coverage is decided by the engineering layer (recency-eng-plan), surfaced to design as a
single `tier` plus a normalized set of measures. Design only needs three branches:

| Tier | Condition | Lead number | Why it still lands |
| --- | --- | --- | --- |
| **A — Full HRRP** | HRRP excess ratio present, ≥1 condition reported | Excess ratio of worst/HF condition (existing `.ratio-big`) | Penalty story is fully intact; we *enrich* it with fresher rates. |
| **B — Partial** | Some HRRP conditions suppressed, ≥1 reported, OR HRRP absent but Hybrid_HWR / OP / rates present | Freshest readmission **rate** (e.g. `Hybrid_HWR` or `READM_30_HF` as a %) | A real, recent number leads; HRRP fills in where it exists. |
| **C — Suppressed-but-rated** | All HRRP suppressed; star rating + some measures exist | Overall **star rating** + freshest available readmission/visit measure | Star rating is the universal backbone — nobody is empty. |

> **UX evidence for adapting the lead, not the layout:** Jakob's Law — users carry
> expectations from every other site. Keep the *frame* (big number → context → table →
> playbook → research → contact) constant so a suppressed hospital's operator and a
> fully-penalized operator both recognize the same tool. Only the payload changes.

---

## 1. The recency strip (shared across all tiers)

The single highest-leverage anti-staleness move. A thin horizontal strip directly under
the hospital name, **before** the lead number, that names the *freshest* signal we have and
dates it. It reframes the whole page as "current as of recent measures," so the lagged
penalty never gets to define the page's freshness.

```
┌────────────────────────────────────────────────────────────────────────┐
│  ◴ FRESHEST SIGNAL   Hospital-wide readmission 13.9%   as of Jun 2024    │  ← green dot, recent
│                      ·  6 measures span Jan 2024 → Jun 2024              │
└────────────────────────────────────────────────────────────────────────┘
```

Reuses `.tag` chip styling and the `--green` accent for "recent." Implementation note: this
is a new `.recency-strip` (flex row, `--surface-soft` background, one accent dot). It always
shows the **most recent** measurement period available for that hospital, never the HRRP one.

### Per-figure "as of" dating — the honesty rule

Every number that appears anywhere on the page wears its own date as a muted suffix. This is
how we are recent *and* honest at the same time — we don't average dates or hide the laggard.

- **Fresh measures** (Hybrid_HWR 2023–24, OP_35/OP_32 2024): date in muted text, no warning.
  `as of Jun 2024` / `as of Dec 2024`.
- **The lagged penalty / excess ratio** (2021–24): date in muted text **plus** an amber
  `.tag` that *names why it lags* — turning a weakness into a credibility signal:
  `as of Jul 2024  ·  CMS penalty cycle — always reported on a ~2-year lag`.

> **Evidence:** the Information Scent / transparency literature (NN/g) — users trust an
> interface more when it explains *why* something is the way it is rather than hiding it.
> Labeling the lag as "how the penalty program works" reframes a stale number as a
> *structural fact about CMS*, not a defect of our tool. It also pre-empts the operator's
> single most likely objection ("this is old data").

A small `ⓘ` affordance on the lagged chip opens one sentence of plain copy:
> "Penalties are set on claims that are ~2 years old by law. The rate and visit measures
> above are the current read; the penalty is the bill you're paying now for that older period."

That sentence is the whole recency thesis in one place: **fresh = where you are; lagged =
what it's costing you right now.** Do not bury it.

---

## 2. The excavation arc, made concrete

Paolo's arc — *pervasiveness → how much YOU carry → the penalty size → the solution* — maps
onto the existing top-to-bottom panel order with minimal new structure. The operator scrolls
and is walked from recognition to scale.

| Step | Operator's internal state | Panel | What leads |
| --- | --- | --- | --- |
| **0. Recency strip** | "OK, this is current." | `.recency-strip` | Freshest dated signal |
| **1. Pervasiveness** | "Right, readmissions — I live this." | Lead block (`.hero`) | The big rate/ratio/stars + "X of Y hospitals in your state carry a penalty" |
| **2. How much YOU carry** | "Huh — I didn't know it was *this* concentrated on me." | New `.burden-line` inside hero | Personal magnitude: your rate vs expected, translated to **patients/year** |
| **3. The penalty size** | "I didn't know it was costing *this much*." | `.cond` table + penalty callout | Excess ratio per condition + the dollar/payment-reduction framing |
| **4. The solution** | "And there's something to do about it." | `playbookPanel` → `researchPanel` → Contact | What better hospitals do → go deeper with AI → talk to us |

### The number that leads (step 1)

- **Tier A:** keep the excess ratio in `.ratio-big`. But add, immediately beside it, the
  **actual rate** from 632h-zaca (e.g. "HF readmission **20.1%**") — the rate is more
  intuitive than a 1.07 ratio and is *fresher-dated*. Ratio = "are you penalized," rate =
  "here's the human number." Lead with rate prominence; ratio is the regulatory proof.
- **Tier B:** the freshest **rate** is the hero number; ratio appears in the table below.
- **Tier C:** the **star rating** is the hero (reuse `.score-ring` — repurpose the conic
  ring to show stars-as-fill, e.g. 3/5), with the freshest visit/readmission measure beside
  it as the supporting number.

### The "how much YOU carry" line (step 2) — the excavation pivot

This is the single most important new sentence on the page and the literal answer to "I
didn't know how big it was." It converts a rate into **bodies**, using only CMS's own
published denominator (`number_of_patients` / `denominator` from 632h-zaca) — no fabricated
math, no ROI claim:

> "At **20.1%**, roughly **1 in 5** of your **1,240** heart-failure discharges came back
> within 30 days last year — about **249 readmissions**. CMS expects ~**210** for your case
> mix. That gap is **~39 avoidable returns a year** you're carrying."

Rules that keep this honest and on-brand (per the brief's no-fabrication constraint):
- Only multiply CMS's published rate by CMS's published denominator. Both are on the page.
- "Expected" comes from the excess-ratio math CMS already publishes; if absent (Tier C),
  drop the expected/gap clause and keep only the count: *"about 249 of your discharges came
  back."* Still lands.
- Never attach a dollar figure to the *avoidable* count (that would be an ROI claim). The
  dollar story lives only in step 3, and only as CMS's actual published payment reduction.

> **Evidence — why bodies beat percentages:** identifiable-victim / unit-effect research
> (Slovic; Kahneman) shows concrete counts move people far more than rates. "20.1%" is
> abstract; "249 patients came back, ~39 didn't have to" is visceral. This is the line that
> makes an operator *feel* the size of the problem they already know exists.

### The penalty size (step 3)

Below the condition table, a single callout (`.penalty-callout`, reusing `--surface-rose`)
states CMS's **actual** published consequence — the payment reduction percentage from the
HRRP file — dated and labeled as the lagged measure:

```
This costs you now:  CMS is reducing your Medicare payments by 0.84%
                     this fiscal year — the penalty for your 2021–2024
                     readmission record.  [as of Jul 2024 · 2-yr lag ⓘ]
```

No invented dollar total (we don't have their Medicare base; inventing it violates the
no-ROI rule). The percentage is CMS's own and is plenty visceral. For Tier C (no penalty
file), this panel is replaced by the **state pervasiveness** card (below) so the slot is
never empty.

---

## 3. The three tiers — ASCII wireframes

Shared chrome (topbar, footer, toast) is unchanged and omitted. Each wireframe shows the
verdict region only.

### Tier A — Full HRRP (the existing case, enriched)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Winchester Hospital                          ⚠ Penalized on 2 of 5 measured   │
│  Middlesex County, MA                            conditions                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  ◴ FRESHEST SIGNAL  HF readmission 20.1%  as of Jun 2024 · 6 measures to 2024  │  recency-strip
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐   Heart failure: 21% more readmissions than expected           │
│  │   20.1%    │   1 in 5 of your 1,240 HF discharges came back within 30 days   │
│  │ HF READMIT │   last year — ~249 returns; CMS expects ~210. You're carrying   │  ← burden-line
│  │ as of      │   ~39 avoidable returns a year.                                 │
│  │ Jun 2024   │   ─────────────────────────────────────────────                │
│  │            │   Excess ratio 1.07  [CMS penalty proof · as of Jul'24 · lag ⓘ] │  ← ratio demoted to proof
│  └────────────┘   Ranked 14 of 18 in MA — 13 do better, 4 do worse.            │
├──────────────────────────────────────────────────────────────────────────────┤
│  All six HRRP conditions                                       [CMS published] │
│  Heart failure   20.1% / 1.07   ⬤ Penalty   rank 14/18 · median 0.99           │
│  COPD            18.4% / 1.03   ⬤ Penalty   rank 11/18 · median 0.98           │
│  Pneumonia       16.0% / 0.97   ◯ OK        rank  6/18 · median 1.00           │
│  Heart attack       —    —      ▢ CMS-suppressed  too few cases                 │
│  ...                                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  ▣ THIS COSTS YOU NOW                                                           │  penalty-callout
│  CMS is cutting your Medicare payments 0.84% this fiscal year — the penalty     │
│  for your 2021–2024 record.            [as of Jul 2024 · 2-yr lag ⓘ]            │
├──────────────────────────────────────────────────────────────────────────────┤
│  One-pager for your leadership                              [Copy] [Print]      │
│  ...                                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  What the hospitals beating you do                            [Start here]      │  playbookPanel
│  ...                                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  Research with AI                                             [AI · latest]     │  researchPanel (renamed)
│  ...                                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│              [ Talk to Endurant about your real panel ]  (button)               │  → contact modal
└──────────────────────────────────────────────────────────────────────────────┘
```

Key change vs today: the **rate leads** and the **burden-line** is inserted; the excess
ratio survives as the regulatory proof line, with its lag honestly chipped.

### Tier B — Partial (some HRRP suppressed, or HRRP absent but rates/Hybrid_HWR present)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Rural Regional Medical Center                  ◑ 1 of 3 measured conditions   │
│  Greene County, OH                                 penalized · 3 suppressed     │
├──────────────────────────────────────────────────────────────────────────────┤
│  ◴ FRESHEST SIGNAL  Hospital-wide readmission 14.2%  as of Jun 2024            │  recency-strip
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐   Across all conditions, 14.2% of your patients came back      │
│  │   14.2%    │   within 30 days — worse than the national rate.               │
│  │ HOSPITAL-  │   That's roughly 1 in 7 of your discharges returning.          │  ← burden-line (count only
│  │ WIDE READM │   ─────────────────────────────────────────────                │     if denominator present)
│  │ as of      │   Where CMS could measure you by condition, you're penalized   │
│  │ Jun 2024   │   on 1 of 3. The other 3 are suppressed — not a pass; just     │
│  └────────────┘   too few cases for CMS to publish.                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  Condition detail — what CMS could and couldn't measure          [CMS published]│
│  Heart failure     21.0% / 1.09  ⬤ Penalty   as of Jul 2024                    │
│  COPD                 —    —      ▢ Suppressed  too few cases                    │
│  Pneumonia         15.5% / 0.96  ◯ OK         as of Jul 2024                    │
│  Outpatient ED visits (OP_35)  8.1%  ↑ above national   as of Dec 2024          │  ← fresher OP measure
│  Outpatient admissions (OP_32) 3.2%  ~ national         as of Dec 2024          │
├──────────────────────────────────────────────────────────────────────────────┤
│  How your state carries this                                   [State context] │  state-pervasiveness
│  127 of 184 OH hospitals carry at least one readmission penalty.               │
│  You are not an outlier — you're in the 69% living with this.                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  One-pager · Playbook · Research with AI · Contact   (same as Tier A)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Tier B's job: never look thin. We fill the page with the fresher OP/Hybrid measures and the
state-pervasiveness card so a partial hospital reads as *information-rich*, not *missing
data*. Suppressed rows are present and explained, not hidden — that explanation ("not a
pass; too few cases for CMS to publish") is itself a credibility beat.

### Tier C — HRRP-suppressed-but-rated (the hospital that gets a dead-end today)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Rockville General Hospital                     ★ Overall rating: 3 of 5       │
│  Montgomery County, MD                             (CMS publishes this for      │
│                                                    nearly every hospital)       │
├──────────────────────────────────────────────────────────────────────────────┤
│  ◴ FRESHEST SIGNAL  Outpatient ED visits 9.4% (above national)  as of Dec 2024 │  recency-strip
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐   CMS doesn't publish per-condition readmission penalties for  │
│  │  ★★★☆☆     │   this hospital — almost always because it's small, critical-  │
│  │  3 of 5    │   access, or specialty, with too few cases to report safely.    │
│  │ CMS        │   That's not a clean bill of health. It means the public        │
│  │ OVERALL    │   penalty file can't see you — but these measures can:          │
│  │ as of 2024 │                                                                 │
│  └────────────┘                                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  What CMS DOES publish for you                                  [CMS published] │  measures-grid
│  Outpatient ED visits (OP_35)        9.4%  ↑ above national   as of Dec 2024    │
│  Outpatient admissions (OP_32)       4.1%  ↑ above national   as of Dec 2024    │
│  Hospital-wide readmission (Hybrid)  15.1% ↑ worse           as of Jun 2024    │
│  Patient experience (HCAHPS)         summary star            as of 2024         │
│  Complications / deaths              compared-to-national     as of 2024        │
├──────────────────────────────────────────────────────────────────────────────┤
│  How your state carries this                                   [State context] │  state-pervasiveness
│  127 of 184 MD hospitals carry at least one readmission penalty. The penalty   │
│  program may not measure you — but the burden it measures is everywhere         │
│  around you, and your outpatient visit measures are running above national.    │
├──────────────────────────────────────────────────────────────────────────────┤
│  Research with AI — pull your current standing                 [AI · latest]   │  researchPanel, repositioned up
│  CMS's penalty file can't see you, but Care Compare and state sources track     │
│  smaller facilities. Run the preset prompt to get your current read.            │
├──────────────────────────────────────────────────────────────────────────────┤
│  One-pager · Playbook · Contact   (same)                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

Tier C is the make-or-break. It replaces today's near-empty `limitedDataCard` with: a star
hero (universal), a real grid of fresh measures CMS *does* publish, state pervasiveness, and
the AI research action **pulled higher** (it's genuinely the best path to recency here).
The arc still completes: pervasiveness (state) → your measures → solution. No dead-end.

> **Evidence — Zeigarnik / completeness:** an obviously-incomplete result reads as a broken
> tool and is abandoned. Filling Tier C with real, dated, above/below-national signals makes
> it feel like a finished readout, which is what keeps a suppressed-hospital operator engaged
> long enough to hit Contact.

---

## 4. Contact modal

Replace the footer text link (`#contactCta`, currently a `mailto:`) **and** the bottom
"talk to Endurant about a pilot" inline link with a single, unmistakable **Contact button**
that opens a modal. The reasons: a mailto link has a high drop-off (it depends on a
configured desktop mail client, it leaves our page, and on mobile it often does nothing),
and it captures no lead if the operator bails. A modal form keeps them on-page and gives us
a real inbound.

> **Evidence — Fitts's Law + commitment:** a large, labeled primary button beats a small
> ambiguous text link for a primary conversion target. And NN/g on forms: the lower the
> friction (3 fields, optional note, no account), the higher the completion.

### Backend choice (static site, no PHI)

Use **Web3Forms** (or Formspree as a drop-in alternative). Rationale:
- Pure client-side POST to their endpoint — no server, fits the Vite static-site constraint.
- No PHI: we collect name, work email, optional free-text note only. The note field carries
  a maxlength and inline microcopy ("Don't include any patient information.") to keep it
  non-PHI by design.
- Built-in spam honeypot; email delivery to joel@enduranthealthspan.com without exposing the
  address in a `mailto:` (kills the address-harvesting + broken-client problems at once).
- The hospital name (and tier) is auto-attached as a hidden field, so every inbound arrives
  pre-qualified — Joel sees *which* hospital and *what they saw* without the operator typing it.

### States — wireframes

**Open (default):**
```
        ┌───────────────────────────────────────────────┐
        │  Talk to Endurant                          ✕   │
        │  We'll run this same logic on your attributed  │
        │  panel — your real patients, not the public    │
        │  picture. Tell us where to reach you.          │
        │                                                │
        │  Name                                          │
        │  ┌──────────────────────────────────────────┐  │
        │  │                                          │  │
        │  └──────────────────────────────────────────┘  │
        │  Work email                                    │
        │  ┌──────────────────────────────────────────┐  │
        │  │                                          │  │
        │  └──────────────────────────────────────────┘  │
        │  Anything you want us to know  (optional)      │
        │  ┌──────────────────────────────────────────┐  │
        │  │                                          │  │
        │  │                                          │  │
        │  └──────────────────────────────────────────┘  │
        │  Don't include any patient information.        │  ← microcopy, --quiet
        │                                                │
        │  Re: Rockville General Hospital · Tier C       │  ← hidden-field echo, --quiet
        │                                                │
        │            [ Cancel ]   [ Send message ]       │
        └───────────────────────────────────────────────┘
```

**Submitting:** primary button disabled, label → "Sending…", inline spinner; inputs
disabled; backdrop click suppressed so they can't lose the in-flight submit.
```
        │            [ Cancel ]   [ ◴ Sending… ]         │   (disabled)
```

**Success:** form swaps to a confirmation panel (do not just close — closing silently feels
like it failed). Auto-dismiss after ~4s OR on button click.
```
        ┌───────────────────────────────────────────────┐
        │                     ✓                          │
        │            Thanks — we'll be in touch          │
        │  We've got your note about Rockville General.  │
        │  Joel reads these directly; expect a reply     │
        │  within a business day.                        │
        │                       [ Done ]                 │
        └───────────────────────────────────────────────┘
```

**Error:** keep the filled form, show an inline error above the buttons in `--rose`, and
offer a `mailto:` as the *fallback only* (so we never trap a motivated lead):
```
        │  Couldn't send just now. Try again, or email   │
        │  joel@enduranthealthspan.com directly.         │  ← --rose
        │            [ Cancel ]   [ Try again ]          │
```

### Behavior / a11y (non-negotiable)
- Trigger: a `.button.primary` labeled **"Talk to Endurant"** in the verdict's bottom slot,
  plus the footer link upgraded to the same button.
- Modal pattern mirrors the existing `.role-gate` (fixed inset, `rgba(14,23,38,.46)` scrim,
  `backdrop-filter: blur`, centered `.role-card`-style panel) so it's visually native.
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. **Focus trap**; focus moves to
  the first field on open and returns to the trigger on close. **Esc closes** (except while
  submitting). Backdrop click closes (except while submitting).
- Email field `type="email"` + `required`; name `required`; note `maxlength` ~600 + optional.
- Honor `prefers-reduced-motion` for the open/close transition (the global media query
  already covers it).

---

## 5. Reframe the AI section: "Research with AI"

The current heading — **"Get what this data can't show — with your own AI"** — is a
self-inflicted wound. It tells the operator the thing they just read is insufficient, which
undercuts the whole readout and our credibility, right before the conversion ask.

Reframe it as **going deeper / getting the very latest**, not compensating.

**New heading:**
> ## Research with AI

**New subcopy:**
> Take this hospital's numbers further. This preset prompt — already loaded with the figures
> above — pulls the very latest: your current penalty cycle, what's changed since these
> measurement periods, the 2026 rules, and a sharper one-pager. Paste it into Claude, ChatGPT,
> Perplexity, or any agent.

**Tag chip:** change `[AI research]` → `[AI · latest]` (positions it as recency, not rescue).

**Footnote (keep, lightly edited):**
> Self-contained — the prompt carries this hospital's CMS data, so it works in Claude Code,
> Codex, or any AI agent with no extra setup.

What changed and why:
- "Get what this data can't show" → "Take this further / pulls the very latest." Same action,
  opposite framing: from *deficit* to *depth*. This is the difference between "our data is
  incomplete" and "here's how to go beyond even the freshest public data."
- For **Tier C only**, the panel moves up (above the playbook) and gets one extra sentence —
  there, AI genuinely is the best route to a current read, so it's positioned as the lead
  action, not an afterthought. For Tier A/B it stays in its current position.

> **Evidence — framing / loss-aversion (Tversky & Kahneman):** identical information framed
> as a gain ("go deeper / get the latest") is received far more favorably than the same thing
> framed as a loss ("what this can't show"). The reframe costs nothing and removes a
> credibility leak immediately before the conversion point.

---

## 6. New CSS surface area (additive only)

All built from existing tokens; no new color or type system. Listed so engineering can scope.

- `.recency-strip` — flex row, `--surface-soft` bg, `--radius-sm`, one `--green` status dot;
  reuses `.tag` for the period chip.
- `.burden-line` — a paragraph variant inside `.hero-copy`; bolded count via existing weight
  tokens; a hairline `border-top: 1px solid var(--line)` to separate "human number" from
  "regulatory proof."
- `.asof` — muted inline date suffix (`--quiet`, 12px); the lagged variant `.asof.lag` adds
  the amber `.tag` + `ⓘ` button.
- `.penalty-callout` — `--surface-rose` panel, single statement, `--rose` heading icon.
- `.measures-grid` — Tier C's "what CMS DOES publish" list; reuses `.cond` row grid with an
  `as of` column instead of rank.
- `.state-pervasiveness` — reuses `.summary-list` styling for the "X of Y hospitals" line.
- `.stars` — Tier C hero; repurpose `.score-ring` OR a simple 5-glyph star row in `--amber`.
- `.contact-modal` — clone of `.role-gate` / `.role-card`; adds `.field` rows (already exist),
  a `.contact-success` state, and a `.contact-error` line in `--rose`.

No changes to grid breakpoints needed — every new block is a single-column panel that already
collapses correctly under the existing `@media (max-width: 760px)` rules.

---

## 7. Priority (impact × effort)

**Critical (ship first):**
1. **Tier C readout** — replaces a dead-end with a complete page. Highest impact on the
   mandate; medium effort (new hero + measures-grid + move research up).
2. **Recency strip + per-figure `as of`** — kills the "stale data" objection across all
   tiers. High impact, low–medium effort.
3. **Contact modal** — direct conversion lift over the broken mailto. High impact, medium
   effort (modal + Web3Forms wiring).

**High:**
4. **Burden-line** (the "bodies, not percentages" sentence) — the emotional core of the
   excavation arc. Medium impact-to-effort; copy-heavy, low code.
5. **Research-with-AI reframe** — removes a credibility leak. High ROI, near-zero effort
   (string changes).

**Medium:**
6. Penalty-callout payment-reduction framing (Tier A/B). Medium effort, depends on the HRRP
   payment field being in the snapshot.

## One big win
If only one thing ships: the **Tier C readout + recency strip together**. That single change
turns "no hospital is a dead-end" and "the data feels recent" from aspirations into the
default experience, and it's exactly the gap the founder called unacceptable.
