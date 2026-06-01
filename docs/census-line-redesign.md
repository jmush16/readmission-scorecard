# The Census Line — redesign plan (post-discharge gap v3)

> Produced 2026-06-01 from two live gstack sessions (office-hours + design-consultation).
>
> **PARTIALLY SUPERSEDED:** the job-to-be-done, the office-hours-hardened content spec,
> and the honesty guardrails below are CURRENT. The visual direction is NOT: the dark
> "vitals-monitor" aesthetic and the click-to-reveal "Census Line" interaction were retired
> after review (dark read as consumer-tech, not a trustworthy clinical tool, and value was
> gated behind clicks). What shipped is a **light, on-brand value-forward report** in the
> Endurant B2B trust palette (warm off-white, clinical blue, navy, orange for alerts only;
> Georgia serif + Inter). See `src/main.ts` / `src/styles.css` and the HANDOFF for the
> shipped structure.

## Why we are rebuilding (the verdict)

v2 shows good data but reads as a data exhibit, not a lead magnet. It leads with commodity
the operator already sees daily (their own readmission rate + HRRP penalty, four stacked
panels) and buries the only non-commodity asset (where their patients go after discharge)
eighth on the page, in the same flat styling as everything else. ~350 words above the fold,
a plaintext `<pre>` one-pager, ~570 of ~1059 lines of dead pre-pivot CSS, generic
SaaS-dashboard tells. It is not actionable and not interactive.

## The one thing a first-time viewer must remember

**"Half my discharged patients vanish into a window I can't see, and I can already name the
SNFs sending them back."**

## The job to be done

Give the care-transitions operator a self-relevant, source-defensible artifact that:
1. Names the blind window in their own post-discharge workflow.
2. Lets them re-triage their discharge census by pathway — the one action they actually own
   (they do NOT control SNF referrals, only where they aim vigilance).
3. Travels upward as a one-pager to the TEAM-liable risk-owner (ACO Med Dir / VP Pop Health / CFO).

Bridge to Endurant's continuous between-visit monitoring as the resolution to the operator's
OWN dead end (they cannot reach half their panel by phone), never as an asserted ROI.

## The concept: The Census Line

One persistent horizontal vitals trace spanning the page:
`Discharge -> 48-72hr call -> [flatline / blind window] -> 7-day visit -> 30-day horizon`.
The trace is lit and moving (ECG-style) where the patient has clinical contact, and goes
flat and dark from the unanswered first call to the 7-day visit. To a clinical reader the
flatline reads as danger instantly, never as broken UI. It also makes the bridge visual: that
flatline is the window we monitor, and the pilot fills it in. Every click lights one region of
the same trace instead of scrolling to a new card. The page is one object that deepens.

## The interactive logic flow (each click earns the next; depth is the proof, not the reveal)

Detonation fires above the fold, before any click. Then four earned layers.

| Layer | Trigger | What lights | Microcopy (final, sourced, guardrail-safe) | Next |
|---|---|---|---|---|
| **0 Detonation** | none (above fold) | full spine draws; lit segments rest, void stays dark; pulse runs once and dies at the flatline | "About half the people you discharge don't answer the first call. Here is where the rest of the month happens to them." | "tap the line to see where they go" |
| **1 The rate is partial by pathway** | click Discharge region | Discharge->call segment brightens | "The rate counts who came back. Not the route they took. The route is your lever." + small dated anchor "reported 30-day readmission: 18.2% · CMS, Jan 2026" | "which route? -> named SNFs" |
| **2 Ranked named SNF map** | click "named SNFs" | call region brightens, panel drops | "4 of your 9 local SNFs send patients back at a rate CMS flags worse than national." Verdict rows: `⚠ WORSE  RIVERSIDE REHAB & NURSING  24.1%`. Degrade line: "all 9 SNFs unlock as the data set expands · CMS, Jan 2026" | "now the part CMS can't see -> the blind window" |
| **3 The blind window (sourced)** | click the void | nothing lights; facts drop onto the dark band at their true x-position | "~49% reached on the first try · 48-72hr"; "medication discrepancies show up · 24-72hr"; "~20% have an adverse event · within 3 weeks" (each with a source tag) | "so what do you do -> the fork" |
| **4 Action fork** | click "what you can do" | two paths at visit->horizon | OPERATOR: "Re-triage your discharge census by pathway." (interactive, seeded with real local SNFs + labeled sample patients). What-if: "Your worst and best local SNF differ by 9 points. You can't move the referral. You can move where you look first." RISK-OWNER: "Export the one-pager." Bridge: "Watching the dangerous pathways harder still leaves the half you can't reach by phone. That gap is the pilot." | — |

**Layer 3 is special:** clicking the void does NOT light it teal. We annotate the darkness;
we do not pretend it is monitored. Teal bridging the void only appears in Layer 4's explicit
"what continuous monitoring fills" overlay, clearly framed as "what we'd add," never current state.

**Thin-county variant of Layer 2 (absence-as-finding):** when a county has <2 reporting SNFs,
the headline becomes "CMS can barely see the network your patients use," verdict `◌ SUPPRESSED`.
Never a statewide median dressed as the local network.

## Honesty guardrails (hard gates, non-negotiable)

1. Public, non-PHI, redistributable data only.
2. No fabricated savings / avoidable-readmission / ROI claims, including by implication. The
   what-if is a vigilance-allocation decision, never a capture claim.
3. Every figure dated to its reporting window.
4. Cross-facility comparison is a national pattern, never the hospital's own number.
5. **No undercount claim.** HRRP measures are all-cause, not index-hospital-restricted; the
   honest gap is *pathway invisibility*, not *count suppression*. (This killed the original
   "your number is a comforting lie" framing.)
6. **No peak-day clustering curve.** State the sourced window only (24-72hr / 7-day / 3-week),
   never "bounce-backs cluster days 3-9" (unsourced, killed).
7. Thin-county data triggers absence-as-finding, never a statewide median masquerading as local.
8. Voice speaks TO the operator's lived reality, never ABOUT CMS / the data / the tool.
9. The Layer-4 "teal fills the void" overlay may name only *the window it fills*, never a
   number, percentage, or outcome.

## Sourced evidence base (from SecondBrain research)

- Medication discrepancies measurable at 24-72hr (Coleman: 14.3% vs 6.1% rehospitalization).
- ~20% adverse events within 3 weeks (AHRQ).
- TCM contact at 2 business days; early-follow-up benefit within 7 days (HF, OR 0.81).
- ~49% reached on first post-discharge call attempt; 2-3 attempts needed; ~76% of connected
  calls surface a real problem.
- Sources on disk: `02 - Brand/intelligence/research/2026-05-27-readmission-reality-check-lead-magnet-validation.md`
  and `.../2026-05-28-readmission-operator-burden-lane-1.md`.

## Competitive floor

CareGraph already exposes a free hospital->SNF->county->readmission graph. Our differentiator
is NOT the raw map. It is the interactive instrument that walks the user to their own
conclusion, the operator re-triage framing, absence-as-finding, the upward one-pager for the
TEAM-liable buyer, and that we are a funnel to a product, not a lookup.

## The funnel weapon (cold-load)

UTM-slug-first deep link: the LinkedIn DM link pre-renders the operator's own hospital
flatline, zero typing (the personalized reciprocity gift in the Paolo comment->DM flow).
Fallback chain: UTM slug -> geolocate to nearest high-volume hospital -> marquee default.
Never an empty entry.

---

# Design system (implementable)

## Color tokens

```css
:root {
  /* FIELD — clinical charcoal, never pure black */
  --field-900:#0f1216; --field-800:#14181d; --field-700:#1b212a; --field-600:#242c38;
  /* INK */
  --ink-100:#eef2f6; --ink-300:#b8c2cf; --ink-500:#7c8896; --ink-700:#4a5563;
  /* SIGNAL — lit, alive trace (clinical contact = monitored) */
  --signal-core:#38e0c4; --signal-glow:rgba(56,224,196,0.35); --signal-dim:#1f6d61;
  /* DARK — flatline / blind window (no signal = no eyes) */
  --dark-line:#3a4250; --dark-void:#0c0e11;
  /* VERDICT — color is NEVER alone; always paired with a word + glyph */
  --verdict-worse:#f2a33c; --verdict-worse-bg:rgba(242,163,60,0.12);
  --verdict-same:#7c8896;
  --verdict-better:#38e0c4;
  --verdict-suppress:#5a4a6b; --verdict-suppress-bg:rgba(90,74,107,0.14);
}
```

Two distinct danger semantics, kept separate on purpose: amber `--verdict-worse` = a facility
performs badly (a number CMS reports). The dark flatline = no one is watching at all (the
absence). `--verdict-suppress` gets its own muted color so suppressed never reads as fine or bad.

## Typography

Two families. Display for few-word headlines (no digits), mono for every number/rate/facility
name/date. The split is the grammar: words are human, numbers are instrument.

```css
--font-display:"Newsreader", Georgia, serif;
--font-mono:"IBM Plex Mono", ui-monospace, monospace;
--t-detonate:clamp(2.0rem,6vw,3.5rem);   /* display 400, leading 1.05, no digits */
--t-headline:clamp(1.5rem,4vw,2.25rem);  /* display 400 */
--t-figure-xl:clamp(1.75rem,5vw,2.75rem);/* mono 600 */
--t-figure:1.125rem;  /* mono 500 */
--t-body:1.0625rem;   /* display 400, leading 1.5 */
--t-meta:0.8125rem;   /* mono 400, ink-500, tracking 0.02em */
```

## Spacing

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`. Spine sits in `--s-24` of vertical air on desktop.

## The flatline / vitals-trace spec

One layered SVG `<path>` set spanning content width, five fixed anchor stations. Lit segments:
`--signal-core` stroke 2px, ECG-style QRS complexes (not a sine wave), a blurred glow path
behind (`--signal-glow`, 8px, blur 6px), and a bright traveling dash. Flatline segment: dead
flat, `--dark-line` 1.5px, NO glow, NO motion, sitting in a `--dark-void` band darker than the
field. One down-step at the call station (signal present -> call unanswered -> goes flat) is the
emotional beat. The flat span is the longest segment (~Discharge->call 25%, void ~45%,
visit->horizon ~30%): the blind window dominates by area. Clicking lights a region from
`--signal-dim` to `--signal-core`; the layer panel slides down beneath the spine (the spine
never moves vertically) anchored by a thin vertical leader line.

## Motion

```css
--ease-signal:cubic-bezier(0.22,0.61,0.36,1);
--dur-light:420ms; --dur-panel:320ms; --dur-pulse:2600ms; --dur-micro:140ms;
```

Hard rule: the only idle motion is the bright pulse traveling left->right along lit segments.
The pulse enters the flatline and dies, re-emerging at the 7-day visit (designed, not a bug).
No parallax, no decorative drift, no glow-dot eyebrow. `prefers-reduced-motion` -> lit vs dark
becomes a pure shape+color state (instant), which is why the flatline survives reduced-motion,
screenshots, and print.

## What dies from the current CSS

All ~570 dead pre-pivot lines (delete, do not comment). The glowing-dot eyebrow. The
glassmorphism topbar (-> flat `--field-900` bar, single hairline border). The 9 same-weight
cards (-> one spine + on-demand panels). Any purple/violet gradient. Card box-shadow blooms
(shadow is reserved for the signal glow). Inter/Roboto/system stacks (-> Newsreader + Plex Mono).

## Wireframe — desktop, first viewport (zero clicks)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ENDURANT                                        built on public CMS data   │
├──────────────────────────────────────────────────────────────────────────┤
│ MERCY GENERAL · discharged panel · 30-day window                           │
│ About half the people you discharge don't                                  │
│ answer the first call. Here is where the                                   │
│ rest of the month happens to them.                                         │
│                                                                            │
│ Discharge      call          ┄┄┄ no eyes ┄┄┄          7-day        30-day   │
│ ●━━━╮          ◐                                      ╭━━●          ◇       │
│ /\ /╰╮ /\    ╱ ╲____________________________________╱   /\ /\              │
│ ▁▁▁▁▁▁▁▁▁▁▁[····· DARK VOID (--dark-void) ·····]▁▁▁▁▁▁▁▁▁▁▁▁                │
│   ▲lit/teal   ▲step down   ▲flat --dark-line          ▲lit/teal            │
│                                                                            │
│ [ the rate ] [ named SNFs ▸ ] [ the blind window ] [ what you can do ]      │
│   L1 earned    L2 locked        L3 locked            L4 locked              │
└──────────────────────────────────────────────────────────────────────────┘
```

## Wireframe — mobile first (the cropped-screenshot punch)

```
┌───────────────────────────┐
│ ENDURANT       CMS · public│
│ MERCY GENERAL              │
│ discharged · 30-day        │
│ About half don't answer    │
│ the first call. Here's     │
│ where the month goes.      │
│ Discharge   call           │
│  ●━━╮       ◐              │
│ /  \ ╰──╮                  │
│ ▁▁▁▁▁▁▁▁│  ← FLATLINE      │   spine rotates toward vertical;
│   no    │     (dark-void)  │   long dark vertical run = blind window
│   eyes  │                  │
│  ___╭───╯                  │
│ /\ ╭╯  7-day               │
│●━━╯       30-day ◇         │
│ MERCY sends more patients  │
│ back than CMS flags safe.  │
│ [ see the 3 named SNFs ▸ ] │   earned tap, bottom thumb zone
└───────────────────────────┘
```

## Layer 2 expanded (and thin-county variant)

```
4 of your 9 local SNFs send patients back at a rate CMS flags worse than national.
⚠ WORSE  RIVERSIDE REHAB & NURSING        24.1%   ▸ expand
⚠ WORSE  OAKHILL POST-ACUTE               22.8%   ▸
⚠ WORSE  ST. CLARE TRANSITIONAL           21.3%   ▸
─────────────────────────────────────────────────────────
all 9 SNFs unlock as the data set expands · CMS, Jan 2026
```
Thin county:
```
CMS can barely see the network your patients use.
◌ SUPPRESSED  only 1 of your local SNFs reports to CMS.
The route your patients take is mostly invisible to the public record.
That invisibility is the finding. CMS, Jan 2026
```

## Word cuts (before -> after)

1. Detonation block (~70 words) -> "About half the people you discharge don't answer the first
   call. Here is where the rest of the month happens to them." (24 words)
2. Layer-1 card -> "The rate counts who came back. Not the route they took." + "18.2% · CMS, Jan 2026."
3. Layer-2 header -> "4 of your 9 local SNFs send patients back at a rate CMS flags worse than
   national." (leads with the count)

---

# The forwardable one-pager

The artifact the CFO sees. Must survive Outlook (strips background colors) and grayscale print.
The flatline renders with **borders and glyphs, not background fills**.

```
┌──────────────────────────────────────────────────────────────┐
│ MERCY GENERAL HOSPITAL                          ENDURANT       │
│ Post-discharge 30-day exposure · public CMS data · Jan 2026    │
│ ──────────────────────────────────────────────────────────────│
│ Discharge   call         the blind window        7-day  30-day │
│ ●═════╗     ◐                                    ╔═════●   ◇    │
│       ╚═════·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ═════╝             │
│             └────────── no clinical contact ──────────┘        │
│ WORST NAMED FACILITY (CMS-flagged worse than national):        │
│ ⚠ RIVERSIDE REHAB & NURSING ............... 24.1%  [WORSE]      │  <- top third ends (screenshot line)
│ THE DOCUMENTED BLIND WINDOW                                    │
│ ~49% reached on first try .............. 48-72hr  [CMS]        │
│ med discrepancies appear ............... 24-72hr  [source]     │
│ ~20% adverse event ..................... within 3wk [source]   │
│ 30-DAY LIABILITY CONTEXT                                       │
│ TEAM 30-day episode accountability · 743 named hospitals · Jan 2026 │
│ Sources: CMS Care Compare [...]. Public, non-PHI. No savings   │
│ or capture estimates are stated or implied.    endurant.health │
└──────────────────────────────────────────────────────────────┘
```

- Spine built from box-drawing borders: lit = `border-top:3px double currentColor` (`═`),
  flat = `border-top:1px dotted` (`·`). Contrast is line-weight/style, which print and email keep.
- Verdicts render as bordered glyph tags `⚠ ... [WORSE]`, never a colored cell.
- Print CSS: white bg, black ink, lit=double border, flat=dotted border, verdict=bordered box,
  hide glow/pulse/topbar, `@page{margin:14mm}`, `page-break-inside:avoid`.
- Export = static HTML (print-to-PDF) + a "copy as image" that rasterizes the same DOM so it
  pastes into email as a picture (carries the flatline) for clients that strip everything.
- Screenshot test: top third alone carries title + spine-with-flatline + worst named SNF + verdict.

---

# Ships now vs data expansion (sequenced)

**Ships in v1 on current data (honest degrade):**
- Detonation, full spine + flatline, Layers 0/1/3 fully.
- Layer 2: top-3 worst named SNFs only, with the "all N unlock as data expands" degrade line.
- Thin-county absence-as-finding.
- One-pager export incl. TEAM context line (known program fact, datable now).
- UTM-slug pre-render + geolocate fallback + marquee default.
- Layer 4 operator re-triage seeded with real local SNF set + labeled sample patients.

**Unlocks with data expansion (designed-for, hidden until present):**
- Layer 2: top-3 -> all local SNFs, rows expand to per-facility detail.
- TEAM flag per hospital (is THIS hospital in the 743) as a badge, not just context text. **(priority 1: static, trivially joinable on CCN, biggest risk-owner trigger.)**
- Star rating / staffing / ownership columns on SNF rows (CMS Provider Info join).
- Geography/proximity (POS file + lat/long) to upgrade "county SNFs" to "the SNFs your patients plausibly go to."

Design rule for honest degrade: never show an empty "all SNFs" frame with 3 rows; v1 explicitly
frames itself as top-3. Absence of data is always labeled, never faked.

---

# Implementation work breakdown

1. **Strip** the ~570 dead pre-pivot CSS lines + glassmorphism + eyebrow dot.
2. **Build the spine**: single layered SVG vitals trace, five stations, lit/flatline states,
   light-on-click region system, panels-below-spine, leader lines, traveling-pulse motion,
   `prefers-reduced-motion` fallback. Mobile-first (vertical spine).
3. **Rewrite all copy** to the few-word, sourced, guardrail-safe microcopy above.
4. **Reorder the readout** to the Layer 0->4 logic flow; collapse the commodity rate to the
   Layer-1 anchor; cut the generic playbook (or move to a single disclosure).
5. **Leakage-map component** (Layer 2): ranked rows, glyph+word+color verdicts, expand-on-click,
   thin-county absence variant.
6. **Layer 4 re-triage**: interactive sort seeded with real local SNFs + labeled sample patients;
   vigilance what-if; the explicit "what monitoring fills" overlay (copy locked, no numbers).
7. **One-pager**: replace the `<pre>` with the bordered/glyph HTML card + print CSS + copy-as-image.
8. **Cold-load**: UTM slug -> geolocate -> marquee default.
9. **Data pipeline expansion** (sequenced, after v1 ships): TEAM list (priority 1), then all-SNFs
   (lift the TOP_N=3 cap), then star/staffing/ownership, then geography/proximity. New `types.ts`
   fields + `scripts/build-snapshot.ts` joins.

# Open risks

1. The flatline could read as "no data" rather than "danger." Mitigation: the down-step + the
   "no clinical contact" bracket frame it as lost signal. Worth a quick test with 2-3 real
   care-transitions operators before launch.
2. Rotating the spine toward vertical on mobile weakens the literal-ECG read; decide horizontal
   scroll-reveal vs vertical with the cropped-screenshot test.
3. Layer 4's "teal fills the void" overlay risks implying a capture claim if copy drifts. Hard
   lock: that overlay names only the window it fills, never a figure.
