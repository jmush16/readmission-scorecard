import "./styles.css";
import type {
  ConditionKey,
  HospitalIndexEntry,
  HospitalProfile,
  HospitalRecord,
  PostAcuteShard,
  ResolvedPostAcute,
  SnapshotManifest,
} from "./lib/hrrp/types";
import { buildProfile } from "./lib/hrrp/profile";
import { postAcuteForCounty, summarizePostAcute } from "./lib/hrrp/postacute";
import { formatPeriod } from "./lib/hrrp/normalize";
import { researchPrompt, researchLinks } from "./lib/hrrp/research";
import { interventionsFor, BILLING_NOTE, SOURCES } from "./lib/hrrp/playbook";

declare global {
  interface Window {
    posthog?: { capture?: (event: string, props?: Record<string, unknown>) => void };
  }
}

const CONTACT_KEY = "75f56baf-5462-4bc0-93e0-739ed3f15c72";
const CONTACT_EMAIL = "joel@enduranthealthspan.com";

// Marquee for the "see an example" link. Northwestern Memorial (Cook County, IL):
// full data, named worse-than-national SNFs nearby.
const MARQUEE = { id: "140281", state: "IL" };

const BASE = import.meta.env.BASE_URL;
const root = document.getElementById("root")!;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;

let index: HospitalIndexEntry[] = [];
let manifest: SnapshotManifest;
let currentProfile: HospitalProfile | null = null;
let currentPostAcute: ResolvedPostAcute | null = null;
let isExample = false;

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/\bSnf\b/g, "SNF");

async function loadData() {
  const [m, idx] = await Promise.all([
    fetch(`${BASE}data/manifest.json`).then((r) => r.json()),
    fetch(`${BASE}data/hospitals.json`).then((r) => r.json()),
  ]);
  manifest = m;
  index = idx;
  document.getElementById("provenance")!.textContent =
    `Sources: CMS Hospital Readmissions Reduction Program (${manifest.sources.hrrp}), Unplanned Hospital Visits ` +
    `(${manifest.sources.unplanned}), Hospital General Information (${manifest.sources.hospitals}), SNF Quality Reporting ` +
    `(${manifest.sources.snfQrp}), Home Health agency data (${manifest.sources.homeHealth}). Public, non-PHI. ` +
    `${manifest.counts.hospitals.toLocaleString()} hospitals, ${manifest.counts.snfFacilities.toLocaleString()} SNFs. ` +
    `No savings or avoidable-readmission estimates are stated or implied.`;
}

// ---------- Routing ----------

function start() {
  const params = new URLSearchParams(location.search);
  const ccn = params.get("ccn") || params.get("h") || params.get("hospital");
  if (ccn) {
    const entry = index.find((h) => h.id === ccn);
    if (entry) {
      selectHospital(entry.id, entry.state, false);
      return;
    }
  }
  renderLanding();
}

// ---------- Landing ----------

function renderLanding() {
  restartBtn.hidden = true;
  root.innerHTML = `
    <section class="landing">
      <div class="eyebrow">Care-transitions intelligence</div>
      <h1>Where do your discharged patients go, and <span class="accent">who sends them back?</span></h1>
      <p class="lede">Search your hospital. See the named skilled-nursing and home-health settings your patients land in,
      ranked by how often each sends a patient back to a hospital bed within 30 days, on public CMS data.</p>
      <ul class="see-list">
        <li><span class="ic">→</span><span><b>The named facilities</b> your patients go to, flagged where CMS says they perform worse than national.</span></li>
        <li><span class="ic">→</span><span><b>The blind window</b>, the roughly 27 days after discharge with no clinical visit, where readmissions are born.</span></li>
        <li><span class="ic">→</span><span><b>A one-pager</b> you can forward to your VP of Population Health or CFO.</span></li>
      </ul>
      <div class="search-box">
        <input id="q" type="text" autocomplete="off" placeholder="Search your hospital, e.g. Northwestern Memorial" aria-label="Hospital name">
        <div class="results" id="results" role="listbox"></div>
      </div>
      <p class="entry-example">or <button type="button" id="seeExample">see an example readout</button></p>
    </section>`;

  const q = document.getElementById("q") as HTMLInputElement;
  const results = document.getElementById("results")!;
  q.focus();
  q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    if (term.length < 3) {
      results.innerHTML = "";
      return;
    }
    const matches = index.filter((h) => h.name.toLowerCase().includes(term)).slice(0, 12);
    results.innerHTML = matches
      .map(
        (h) =>
          `<button class="result-item" type="button" data-id="${h.id}" data-state="${h.state}">
            <b>${esc(titleCase(h.name))}</b><span>${h.county ? `${titleCase(h.county)} County, ` : ""}${h.state}</span>
          </button>`,
      )
      .join("");
    results.querySelectorAll<HTMLButtonElement>(".result-item").forEach((btn) => {
      btn.addEventListener("click", () => selectHospital(btn.dataset.id!, btn.dataset.state!, false));
    });
  });
  document.getElementById("seeExample")!.addEventListener("click", () => selectHospital(MARQUEE.id, MARQUEE.state, true));
}

async function selectHospital(id: string, state: string, asExample: boolean) {
  isExample = asExample;
  root.innerHTML = `<p class="lede" style="margin-top:48px">Loading the post-discharge picture…</p>`;
  const [shard, paShard] = await Promise.all([
    fetch(`${BASE}data/states/${state}.json`).then((r) => r.json()) as Promise<HospitalRecord[]>,
    fetch(`${BASE}data/postacute/${state}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<PostAcuteShard>) : null))
      .catch(() => null),
  ]);
  currentProfile = buildProfile(id, shard);
  currentPostAcute = paShard ? postAcuteForCounty(paShard, currentProfile.hospital.county) : null;
  renderReadout(currentProfile, currentPostAcute);
  window.posthog?.capture?.("hospital_viewed", { state, tier: currentProfile.tier, example: asExample });
  window.scrollTo(0, 0);
}

// ---------- Verdict helper ----------

function verdictChip(worse: boolean | null, verdict: string | null) {
  if (worse === true) return { cls: "v-worse", glyph: "⚠", word: "WORSE" };
  if (worse === false) return { cls: "v-better", glyph: "✓", word: "BETTER" };
  if (verdict && verdict.trim()) return { cls: "v-same", glyph: "=", word: "SAME" };
  return { cls: "v-suppress", glyph: "◌", word: "SUPPRESSED" };
}

// ---------- Result banner ----------

function resultBanner(p: HospitalProfile, pa: ResolvedPostAcute | null): string {
  const snf = pa?.snf ?? null;
  const county = p.hospital.county ? titleCase(p.hospital.county) : null;

  if (!snf || snf.verdictCount === 0 || pa?.usedState || snf.topWorst.length === 0) {
    return `<div class="result">
      <h1>Where your patients go next is <span class="hot">mostly invisible</span> to the public record.</h1>
      <p class="sub">${county ? `CMS reports too few skilled-nursing facilities in ${county} County to name the route your patients take.` : "Your county is below CMS's public reporting threshold for skilled nursing."} That blind spot is the finding: the gap starts before the patient even leaves the building.</p>
    </div>`;
  }

  const worst = snf.topWorst[0];
  if (snf.worseCount > 0) {
    return `<div class="result">
      <h1><span class="hot">${snf.worseCount}</span> of the skilled-nursing facilities your patients go to send them back at a rate CMS flags <span class="hot">worse than national</span>.</h1>
      <p class="sub">The worst, <b>${esc(titleCase(worst.name))}</b>, sends <b>${worst.rate !== null ? `${worst.rate.toFixed(1)}%` : "a share"}</b> of patients back to a hospital within 30 days. You can't redirect a referral, but you can decide who gets watched closest.</p>
    </div>`;
  }
  return `<div class="result calm">
    <h1>Here is where your patients go after discharge, ranked by how often each sends them back.</h1>
    <p class="sub">None of the reporting facilities are flagged worse than national, but the post-discharge window is still where readmissions are born.</p>
  </div>`;
}

// ---------- Leakage map ----------

function leakMapCard(p: HospitalProfile, pa: ResolvedPostAcute | null): string {
  const county = p.hospital.county ? titleCase(p.hospital.county) : null;
  const snfPeriod = manifest.postAcutePeriods?.snfPpr ? formatPeriod(manifest.postAcutePeriods.snfPpr) : "";
  const snf = pa?.snf ?? null;

  if (!snf || snf.verdictCount === 0 || pa?.usedState || snf.topWorst.length === 0) {
    const med = snf?.pprMedian ?? null;
    return `<section class="card card-pad">
      <div class="card-head"><h2>Where your patients go next</h2><p>Skilled-nursing facilities your patients are discharged to.</p></div>
      <div class="absence">
        <b>CMS can barely see the post-acute network your patients use.</b>
        ${county ? `Too few of the skilled-nursing facilities in ${county} County report to CMS to name the route your patients take.` : "Your county is below CMS's public reporting threshold."}
        The invisibility is the finding.
      </div>
      ${med !== null ? `<p class="src-line">Statewide, not your county: the median reporting SNF in ${p.hospital.state} rehospitalizes ${med}% of patients within 30 days.</p>` : ""}
      <p class="src-line">SNF 30-day potentially-preventable rehospitalization (CMS SNF Quality Reporting${snfPeriod ? `, ${snfPeriod}` : ""}). Scope labeled honestly: county data is too sparse to localize.</p>
    </section>`;
  }

  const ref = pa!.national.snfPprMedian ?? snf.pprMedian ?? 0;
  const max = Math.max(ref, ...snf.topWorst.map((f) => f.rate ?? 0)) * 1.15 || 1;
  const worst = snf.topWorst[0];
  const gap = worst.rate !== null && snf.pprMedian !== null ? Math.round((worst.rate - snf.pprMedian) * 10) / 10 : null;

  const rows = snf.topWorst
    .map((f, i) => {
      const v = verdictChip(f.worse, f.verdict);
      const rate = f.rate ?? 0;
      const fillPct = Math.max(5, Math.round((rate / max) * 100));
      const tickPct = ref > 0 ? Math.round((ref / max) * 100) : 0;
      return `<div class="leak-row">
        <span class="leak-rank">${i + 1}</span>
        <span class="leak-name">${esc(titleCase(f.name))}</span>
        <span class="leak-rate">${f.rate !== null ? `${f.rate.toFixed(1)}%` : "—"}</span>
        <span class="verdict ${v.cls}">${v.glyph} ${v.word}</span>
        <span class="leak-track"><span class="leak-fill ${v.cls}" style="width:${fillPct}%"></span>${tickPct ? `<span class="leak-tick" style="left:${tickPct}%"></span>` : ""}</span>
      </div>`;
    })
    .join("");

  return `<section class="card card-pad">
    <div class="card-head"><h2>Where your patients go next</h2><p>Skilled-nursing facilities your patients land in, worst first, by 30-day rehospitalization.</p></div>
    <div class="leak-map">${rows}</div>
    <div class="leak-legend">
      <span class="ref">national median ${ref.toFixed(1)}%</span>
      <span>worst 3 of ${snf.reporting} reporting SNFs${county ? ` in ${county} County` : ""}</span>
    </div>
    ${gap !== null && gap > 0 ? `<p class="src-line" style="color:var(--slate);font-size:13.5px;margin-top:12px">Your worst local SNF runs <b style="color:var(--orange-ink)">${gap} points</b> above the county median. The patients landing there are the ones to watch closest.</p>` : ""}
    <p class="src-line">SNF 30-day potentially-preventable rehospitalization (CMS SNF Quality Reporting${snfPeriod ? `, ${snfPeriod}` : ""}). The national reference is the median of reporting SNFs (CMS publishes no SNF national rate). The full ranked network unlocks as the data set expands.</p>
  </section>`;
}

// ---------- Gap timeline ----------

function gapTimelineCard(): string {
  return `<section class="card card-pad gap-card">
    <div class="card-head"><h2>The window you can't see</h2><p>After discharge, most of the 30 days happen with no clinical visit, and half your panel never answers the first call.</p></div>
    <div class="timeline">
      <svg viewBox="0 0 1000 130" role="img" aria-label="A timeline of the 30 days after discharge. Between the 48-72 hour call and the 7-day visit, roughly 27 days pass with no clinical visit.">
        <line class="tl-track" x1="24" y1="64" x2="976" y2="64"></line>
        <rect class="tl-band" x="212" y="48" width="576" height="32" rx="8"></rect>
        <text class="tl-band-label" x="500" y="68" text-anchor="middle">~27 days, no clinical visit, no eyes</text>
        <circle class="tl-node-end" cx="24" cy="64" r="7"></circle>
        <circle class="tl-node" cx="212" cy="64" r="5"></circle>
        <circle class="tl-node" cx="788" cy="64" r="5"></circle>
        <circle class="tl-node-end" cx="976" cy="64" r="7"></circle>
        <text class="tl-label" x="24" y="34">Discharge</text>
        <text class="tl-sub" x="24" y="98">day 0</text>
        <text class="tl-label" x="212" y="34" text-anchor="middle">48–72hr call</text>
        <text class="tl-sub" x="212" y="98" text-anchor="middle">~half don't answer</text>
        <text class="tl-label" x="788" y="34" text-anchor="middle">7-day visit</text>
        <text class="tl-label" x="976" y="34" text-anchor="end">Day 30</text>
      </svg>
    </div>
    <div class="bw-chips">
      <span class="bw-chip"><span class="num">~half</span> don't answer the first call <span class="w">· 48–72hr</span></span>
      <span class="bw-chip">medication problems already appear <span class="w">· 24–72hr</span></span>
      <span class="bw-chip"><span class="num">~1 in 5</span> has an adverse event <span class="w">· ≤3 weeks</span></span>
    </div>
    <p class="src-line">Coleman Care Transitions Intervention (medication discrepancies 24–72hr); AHRQ (~20% adverse events within 3 weeks); post-discharge call connect rates from transitional-care literature. A documented window, not a peak-day claim.</p>
  </section>`;
}

// ---------- Why + CTA (rail) ----------

function whyCard(): string {
  return `<section class="why-card">
    <h3>Why the gap stays open</h3>
    <p>A transitional-care program is 2 to 3 snapshots across 30 days. Half your panel never answers the first call, so for much of it even those snapshots are blank.</p>
    <p>Adding staff doesn't close a visibility gap. Continuous between-visit signal does.</p>
  </section>`;
}

function ctaCard(): string {
  return `<section class="cta-card cta-bottom">
    <h3>Want full visibility into the gap?</h3>
    <p>Endurant monitors patients continuously after discharge, across the whole treatment plan.</p>
    <button class="button primary book" type="button" id="contactBtn">Book a Demo</button>
  </section>`;
}

// ---------- One-pager (clean leadership brief) ----------

function onePagerCard(p: HospitalProfile, pa: ResolvedPostAcute | null): string {
  const place = `${p.hospital.county ? `${titleCase(p.hospital.county)} County, ` : ""}${p.hospital.state}`;
  const period = manifest.postAcutePeriods?.snfPpr ? formatPeriod(manifest.postAcutePeriods.snfPpr) : "";
  const snf = pa?.snf ?? null;
  const localized = snf && !pa?.usedState && snf.topWorst.length > 0;

  let resultLine: string;
  let table: string;
  if (localized && snf!.worseCount > 0) {
    resultLine = `<div class="op-result"><span class="hot">${snf!.worseCount}</span> skilled-nursing facilities this hospital's patients use are CMS-flagged worse than national for 30-day rehospitalization.</div>`;
  } else if (localized) {
    resultLine = `<div class="op-result">Where this hospital's patients go after discharge, ranked by 30-day rehospitalization.</div>`;
  } else {
    resultLine = `<div class="op-result">CMS reports too few skilled-nursing facilities in this county to localize the post-acute network. The route patients take is largely invisible to the public record.</div>`;
  }
  if (localized) {
    table = `<div class="op-label">Named facilities your patients land in</div>
      <table class="op-table"><tbody>${snf!.topWorst
        .map((f) => `<tr><td>${esc(titleCase(f.name))}</td><td class="rate">${f.rate !== null ? `${f.rate.toFixed(1)}%` : "—"}</td><td class="flag">${f.worse ? `<span class="op-flag">WORSE</span>` : ""}</td></tr>`)
        .join("")}</tbody></table>
      <p class="op-sub">vs a national median of ${(pa!.national.snfPprMedian ?? snf!.pprMedian ?? 0).toFixed(1)}% (median of reporting SNFs; CMS publishes no SNF national rate).</p>`;
  } else {
    table = "";
  }

  return `<div class="onepager" id="onePager">
    <div class="op-top"><span class="op-title">The Post-Discharge Gap</span><span class="op-brand">ENDURANT</span></div>
    <div class="op-meta">${esc(titleCase(p.hospital.name))} · ${place} · public CMS data${period ? ` · ${period}` : ""}</div>
    ${resultLine}
    ${table}
    <div class="op-label">The blind window</div>
    <div class="op-li"><span>About half the panel is reached on the first call</span><span class="w">48–72 hr</span></div>
    <div class="op-li"><span>Medication problems already measurable</span><span class="w">24–72 hr</span></div>
    <div class="op-li"><span>Roughly 1 in 5 has an adverse event</span><span class="w">within 3 wk</span></div>
    <div class="op-label">30-day liability</div>
    <div class="op-li"><span>CMS TEAM model: 30-day episode accountability begins Jan 2026 for 743 named hospitals.</span><span class="w"></span></div>
    <p class="op-foot">Sources: CMS HRRP, Unplanned Hospital Visits, SNF Quality Reporting, Home Health. Public, non-PHI. Each figure dated to its measurement window. No savings, avoidable-readmission, or ROI estimates are stated or implied. <span class="site">readmissions.enduranthealthspan.com</span></p>
  </div>`;
}

function onePagerText(p: HospitalProfile, pa: ResolvedPostAcute | null): string {
  const place = `${p.hospital.county ? `${titleCase(p.hospital.county)} County, ` : ""}${p.hospital.state}`;
  const lines = [`THE POST-DISCHARGE GAP`, `${titleCase(p.hospital.name)} · ${place} · public CMS data, non-PHI`, ``];
  const snf = pa?.snf ?? null;
  if (snf && !pa?.usedState && snf.topWorst.length) {
    if (snf.worseCount > 0) lines.push(`${snf.worseCount} skilled-nursing facilities this hospital's patients use are CMS-flagged WORSE than national for 30-day rehospitalization.`, ``);
    lines.push(`Named facilities your patients land in (30-day rehospitalization):`);
    snf.topWorst.forEach((f) => lines.push(`  - ${titleCase(f.name)}: ${f.rate !== null ? `${f.rate.toFixed(1)}%` : "—"}${f.worse ? " (WORSE than national)" : ""}`));
    lines.push(`  vs national median ${(pa!.national.snfPprMedian ?? snf.pprMedian ?? 0).toFixed(1)}% (median of reporting SNFs).`);
  } else {
    lines.push(`POST-ACUTE NETWORK: CMS reports too few SNFs in this county to localize the network. The route is largely invisible to the public record (the absence is the finding).`);
  }
  const gap = pa ? summarizePostAcute(pa) : "";
  if (gap) lines.push(``, gap + ".");
  lines.push(
    ``,
    `THE BLIND WINDOW:`,
    `  - About half the panel is reached on the first call (48-72 hr)`,
    `  - Medication problems already measurable (24-72 hr)`,
    `  - Roughly 1 in 5 has an adverse event (within 3 weeks)`,
    ``,
    `30-DAY LIABILITY: CMS TEAM model begins Jan 2026 for 743 named hospitals.`,
    ``,
    `Sources: CMS public data. Non-PHI. Each figure dated to its window. No savings or ROI claims stated or implied.`,
    `readmissions.enduranthealthspan.com`,
  );
  return lines.join("\n");
}

// ---------- Disclosures ----------

function workupDisclosure(p: HospitalProfile): string {
  const b = p.benchmark;
  const condRows =
    b.reportedCount > 0
      ? b.conditions
          .map((c) => {
            if (c.suppressed)
              return `<div class="cond-row"><b>${c.label}</b><span class="num neutral">—</span><span class="verdict v-suppress">◌ SUPPRESSED</span><span class="meta">too few cases</span></div>`;
            const cls = c.penalized ? "worse" : "neutral";
            const v = c.penalized ? `<span class="verdict v-worse">⚠ PENALTY</span>` : `<span class="verdict v-same">= OK</span>`;
            return `<div class="cond-row"><b>${c.label}</b><span class="num ${cls}">${c.excessRatio?.toFixed(2)}</span>${v}<span class="meta">rank ${c.rank}/${c.peerCount} · median ${c.stateMedian?.toFixed(2)}</span></div>`;
          })
          .join("")
      : `<p class="disc-lead">CMS hasn't scored this hospital on the penalty program, typical for smaller or specialty facilities.</p>`;

  const measureRows = p.recency.length
    ? p.recency
        .map((r) => {
          const cls = r.worse === true ? "worse" : r.worse === false ? "better" : "neutral";
          return `<div class="measure-row"><b>${r.label}</b><span class="num ${cls}">${r.value}</span><span class="meta">${r.comparedToNational ?? ""} · ${r.asOf}</span></div>`;
        })
        .join("")
    : "";

  const burden = p.burden
    ? `<p class="disc-lead">Roughly <b style="color:var(--ink)">${p.burden.returned.toLocaleString()}</b> ${p.burden.label.toLowerCase()} patients came back within 30 days${p.burden.denominator ? ` of ${p.burden.denominator.toLocaleString()} CMS counted` : ""} (${p.burden.asOf}).</p>`
    : "";

  return `<details class="disclosure">
    <summary><span>The full CMS workup <span class="sub">· this hospital's own rate and HRRP penalty audit</span></span><span class="chev">›</span></summary>
    <div class="disc-body">
      ${burden}
      ${measureRows ? `<div class="disc-sublabel">Current readmission measures</div>${measureRows}` : ""}
      <div class="disc-sublabel">HRRP penalty (lags ~2 yr by law · ${manifest.hrrpPeriod.start}–${manifest.hrrpPeriod.end})</div>
      ${condRows}
    </div>
  </details>`;
}

function playbookDisclosure(condition: ConditionKey): string {
  const items = interventionsFor(condition).map((i) => `<li><b>${i.title}</b>${i.detail}</li>`).join("");
  return `<details class="disclosure">
    <summary><span>What the leaders do <span class="sub">· interventions and the billing that pays for it</span></span><span class="chev">›</span></summary>
    <div class="disc-body">
      <ul class="play-list">${items}</ul>
      <div class="disc-sublabel">${BILLING_NOTE.title}</div>
      <p class="disc-lead">${BILLING_NOTE.detail}</p>
      <p class="src-line">${BILLING_NOTE.caveat}</p>
      <p class="src-line">${SOURCES}</p>
    </div>
  </details>`;
}

function researchDisclosure(): string {
  return `<details class="disclosure">
    <summary><span>Research it yourself <span class="sub">· a preset AI prompt seeded with this hospital's data</span></span><span class="chev">›</span></summary>
    <div class="disc-body">
      <p class="disc-lead">Pull the current penalty, what's changed since the CMS cycle, and the 2026 rules. The prompt carries this hospital's numbers.</p>
      <div class="button-row">
        <button class="button primary" type="button" id="copyResearch">Copy the prompt</button>
        <a class="button" id="openChatgpt" target="_blank" rel="noopener">ChatGPT</a>
        <a class="button" id="openClaude" target="_blank" rel="noopener">Claude</a>
        <a class="button" id="openPerplexity" target="_blank" rel="noopener">Perplexity</a>
      </div>
      <p class="src-line">Works in Claude Code, Codex, or any AI agent. A self-contained prompt with this hospital's CMS data built in.</p>
    </div>
  </details>`;
}

// ---------- Render the readout ----------

function renderReadout(p: HospitalProfile, pa: ResolvedPostAcute | null) {
  restartBtn.hidden = false;
  const place = `${p.hospital.county ? `${titleCase(p.hospital.county)} County, ` : ""}${p.hospital.state}`;
  const targetCondition: ConditionKey = p.benchmark.worst?.condition ?? "HF";

  root.innerHTML = `
    <div class="readout-head">
      <div class="hosp">
        <span class="hosp-name">${esc(titleCase(p.hospital.name))}</span>
        <span class="hosp-place">${place} · 30-day post-discharge window</span>
        ${isExample ? `<span class="example-tag">EXAMPLE</span>` : ""}
      </div>
    </div>

    ${resultBanner(p, pa)}

    <div class="report">
      <div class="col-main">
        ${leakMapCard(p, pa)}
        ${gapTimelineCard()}
      </div>
      <div class="col-rail">
        ${whyCard()}
      </div>
    </div>

    <section class="onepager-section">
      <div class="onepager-head">
        <h2>One-pager for leadership</h2>
        <div class="button-row">
          <button class="button" type="button" id="copyOnePager">Copy</button>
          <button class="button" type="button" id="printOnePager">Print</button>
        </div>
      </div>
      ${onePagerCard(p, pa)}
    </section>

    <div class="disclosures">
      ${workupDisclosure(p)}
      ${playbookDisclosure(targetCondition)}
      ${researchDisclosure()}
    </div>

    ${ctaCard()}`;

  document.getElementById("contactBtn")!.addEventListener("click", openContactModal);
  document.getElementById("copyOnePager")!.addEventListener("click", () => copyText(onePagerText(p, pa), "One-pager copied. Paste into an email to leadership."));
  document.getElementById("printOnePager")!.addEventListener("click", () => window.print());

  const prompt = researchPrompt(p.benchmark, manifest.hrrpPeriod, pa ? summarizePostAcute(pa) : undefined);
  const links = researchLinks(prompt);
  document.getElementById("copyResearch")?.addEventListener("click", () => copyText(prompt, "Research prompt copied"));
  const setHref = (id: string, href: string) => {
    const a = document.getElementById(id) as HTMLAnchorElement | null;
    if (a) a.href = href;
  };
  setHref("openChatgpt", links.chatgpt);
  setHref("openClaude", links.claude);
  setHref("openPerplexity", links.perplexity);
}

// ---------- Contact modal ----------

function buildContactModal() {
  const el = document.createElement("div");
  el.className = "modal-back";
  el.id = "contactModal";
  el.hidden = true;
  el.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="contactTitle">
      <button class="modal-close" type="button" id="contactClose" aria-label="Close">×</button>
      <h2 id="contactTitle">Get full visibility after discharge</h2>
      <p>Endurant monitors your patients continuously after discharge, across the whole treatment plan. Tell us where to reach you.</p>
      <form id="contactForm">
        <input type="text" name="botcheck" class="hp" tabindex="-1" autocomplete="off">
        <div class="modal-field"><label for="cName">Name</label><input id="cName" name="name" type="text" required></div>
        <div class="modal-field"><label for="cEmail">Work email</label><input id="cEmail" name="email" type="email" required></div>
        <div class="modal-field"><label for="cNote">Anything you want us to know (optional)</label><textarea id="cNote" name="note"></textarea></div>
        <button class="button primary" type="submit" style="width:100%">Send</button>
      </form>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener("click", (e) => {
    if (e.target === el) closeContactModal();
  });
  document.getElementById("contactClose")!.addEventListener("click", closeContactModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.hidden) closeContactModal();
  });
  document.getElementById("contactForm")!.addEventListener("submit", submitContact);
}

function openContactModal() {
  const el = document.getElementById("contactModal")!;
  el.hidden = false;
  (document.getElementById("cName") as HTMLInputElement).focus();
  window.posthog?.capture?.("contact_opened", { hospital_ccn: currentProfile?.hospital.id, state: currentProfile?.hospital.state });
}

function closeContactModal() {
  document.getElementById("contactModal")!.hidden = true;
}

async function submitContact(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const fd = new FormData(form);
  if (fd.get("botcheck")) return;
  const name = String(fd.get("name") ?? "");
  const email = String(fd.get("email") ?? "");
  const note = String(fd.get("note") ?? "");
  const hospital = currentProfile ? `${currentProfile.hospital.name} (${currentProfile.hospital.id})` : "";

  const ok = () => {
    window.posthog?.capture?.("contact_submitted", { hospital_ccn: currentProfile?.hospital.id, state: currentProfile?.hospital.state });
    closeContactModal();
    showToast("Thanks, we'll be in touch about a pilot.");
    form.reset();
  };

  if (CONTACT_KEY) {
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: CONTACT_KEY, name, email, hospital, message: note, subject: "Post-Discharge Gap pilot inquiry" }),
      });
      if (res.ok) return ok();
    } catch {
      /* fall through to mailto */
    }
  }
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nHospital: ${hospital}\n\n${note}`);
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=Post-Discharge%20Gap%20pilot&body=${body}`;
  ok();
}

// ---------- Toast / copy ----------

function showToast(message: string) {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout((showToast as unknown as { t: number }).t);
  (showToast as unknown as { t: number }).t = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function copyText(text: string, message: string) {
  navigator.clipboard.writeText(text).then(
    () => showToast(message),
    () => {
      const a = document.createElement("textarea");
      a.value = text;
      document.body.appendChild(a);
      a.select();
      document.execCommand("copy");
      a.remove();
      showToast(message);
    },
  );
}

// ---------- Init ----------

restartBtn.addEventListener("click", renderLanding);
document.getElementById("bookNav")?.addEventListener("click", openContactModal);
buildContactModal();

loadData()
  .then(start)
  .catch((e) => {
    console.error(e);
    root.innerHTML = `<p class="lede" style="margin-top:48px">Could not load the CMS data snapshot. ${String(e)}</p>`;
  });
