import "./styles.css";
import "./benchmark.css";
import type {
  BenchmarkResult,
  ConditionBenchmark,
  HospitalIndexEntry,
  HospitalRecord,
  SnapshotManifest,
} from "./lib/hrrp/types";
import { benchmarkHospital, statePenaltyCount } from "./lib/hrrp/benchmark";
import { researchPrompt, researchLinks } from "./lib/hrrp/research";
import { interventionsFor, BILLING_NOTE, SOURCES } from "./lib/hrrp/playbook";
import type { ConditionKey } from "./lib/hrrp/types";

const BASE = import.meta.env.BASE_URL;
const root = document.getElementById("root")!;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;

let index: HospitalIndexEntry[] = [];
let manifest: SnapshotManifest;

async function loadData() {
  const [m, idx] = await Promise.all([
    fetch(`${BASE}data/manifest.json`).then((r) => r.json()),
    fetch(`${BASE}data/hospitals.json`).then((r) => r.json()),
  ]);
  manifest = m;
  index = idx;
  const period = `${manifest.hrrpPeriod.start}–${manifest.hrrpPeriod.end}`;
  document.getElementById("provenance")!.textContent =
    `Source: CMS Hospital Readmissions Reduction Program (dataset ${manifest.sources.hrrp}), ` +
    `period ${period}. Public, non-PHI. ${manifest.counts.hospitals.toLocaleString()} hospitals.`;
}

// ---------- Landing ----------

function renderLanding() {
  restartBtn.hidden = true;
  root.innerHTML = `
    <section class="landing">
      <div class="eyebrow" style="justify-content:center">Care transitions intelligence</div>
      <h1>Is your hospital being penalized for readmissions — and how do you compare?</h1>
      <p class="lede">CMS publishes every hospital's 30-day readmission performance, but as 18,000 raw rows
      with no ranking. We assemble it: your numbers, your penalty status, and where you stand against the
      hospitals next to you.</p>
      <div class="doors">
        <button class="door" type="button" id="doorOperator">
          <span class="verb">Benchmark my hospital</span>
          <span class="who">For the people who run the work: Director of Care Transitions,
          Care Management / Care Coordination Lead, Transitional Care RN, Readmission-Reduction
          Program Coordinator.</span>
          <span class="go">See our numbers vs. our peers →</span>
        </button>
        <div class="door coming-soon" id="doorMarket">
          <span class="soon-tag">Coming soon</span>
          <span class="verb">Map my market</span>
          <span class="who">For the people who own the risk: ACO Medical Director, CMO,
          VP Population Health, VP Value-Based Care, Medical Economics / CFO.</span>
          <span class="go">Rank every hospital in a market by penalty exposure.</span>
        </div>
      </div>
    </section>`;
  document.getElementById("doorOperator")!.addEventListener("click", renderSearch);
}

// ---------- Hospital search ----------

function renderSearch() {
  restartBtn.hidden = false;
  root.innerHTML = `
    <section class="landing" style="padding-bottom:0">
      <div class="eyebrow" style="justify-content:center">Benchmark my hospital</div>
      <h1 style="font-size:clamp(28px,3.4vw,40px)">Find your hospital</h1>
      <p class="lede">Type your hospital's name. Everything that follows is CMS's published data.</p>
    </section>
    <div class="search-card">
      <div class="search-box">
        <input id="q" type="text" autocomplete="off" placeholder="e.g. Winchester Hospital" aria-label="Hospital name">
        <div class="results" id="results" role="listbox"></div>
      </div>
    </div>`;

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
            <b>${h.name}</b><span>${h.county ?? "?"} County, ${h.state}</span>
          </button>`,
      )
      .join("");
    results.querySelectorAll<HTMLButtonElement>(".result-item").forEach((btn) => {
      btn.addEventListener("click", () =>
        selectHospital(btn.dataset.id!, btn.dataset.state!),
      );
    });
  });
}

async function selectHospital(id: string, state: string) {
  root.innerHTML = `<p class="lede" style="text-align:center">Loading ${state} hospitals…</p>`;
  const shard: HospitalRecord[] = await fetch(`${BASE}data/states/${state}.json`).then((r) =>
    r.json(),
  );
  renderVerdict(benchmarkHospital(id, shard), shard);
}

// ---------- Verdict ----------

function fmtRatio(err: number | null): string {
  return err === null ? "—" : err.toFixed(2);
}

function pctVsExpected(err: number): string {
  const delta = Math.round((err - 1) * 100);
  if (delta > 0) return `${delta}% more readmissions than expected`;
  if (delta < 0) return `${Math.abs(delta)}% fewer readmissions than expected`;
  return "right at the expected rate";
}

function rankSentence(c: ConditionBenchmark, state: string): string {
  if (c.rank === null) return "";
  const better = c.rank - 1;
  const worse = c.peerCount - c.rank;
  return `Ranked ${c.rank} of ${c.peerCount} in ${state} (1 = lowest). ` +
    `${better} ${state} hospital${better === 1 ? "" : "s"} do better; ${worse} do worse.`;
}

function heroCondition(r: BenchmarkResult): ConditionBenchmark | null {
  if (r.worst) return r.worst;
  const hf = r.conditions.find((c) => c.condition === "HF" && !c.suppressed);
  if (hf) return hf;
  return r.conditions.find((c) => !c.suppressed) ?? null;
}

function renderVerdict(r: BenchmarkResult, shard: HospitalRecord[]) {
  restartBtn.hidden = false;
  const hero = heroCondition(r);
  const targetCondition: ConditionKey = hero?.condition ?? "HF";
  const penaltyBadge =
    r.penalizedCount > 0
      ? `<span class="badge penalty">⚠ Penalized on ${r.penalizedCount} of ${r.reportedCount} measured conditions</span>`
      : r.reportedCount > 0
        ? `<span class="badge ok">Not currently in penalty territory (${r.reportedCount} measured)</span>`
        : `<span class="badge">CMS suppressed every measure for this hospital</span>`;

  const heroHtml =
    hero
      ? `<div class="hero">
         <div class="ratio-big">
           <strong style="color:${hero.penalized ? "var(--rose)" : "var(--green)"}">${fmtRatio(hero.excessRatio)}</strong>
           <small>excess readmission ratio</small>
         </div>
         <div class="hero-copy">
           <h3>${hero.label}: ${pctVsExpected(hero.excessRatio!)}</h3>
           <p>${
             hero.penalized
               ? `An excess ratio above 1.00 means CMS pays you less — this is penalty territory.`
               : `An excess ratio at or below 1.00 keeps you out of penalty territory for this condition.`
           }</p>
           <p class="peers">${rankSentence(hero, r.hospital.state)}</p>
         </div>
       </div>`
      : limitedDataCard(r, shard);

  const rows = r.conditions
    .map((c) => {
      if (c.suppressed) {
        return `<div class="cond">
          <b>${c.label}</b>
          <span class="num muted">—</span>
          <span class="pill suppressed">CMS-suppressed</span>
          <span class="muted">too few cases to report</span>
          <span></span>
        </div>`;
      }
      const pill = c.penalized
        ? `<span class="pill penalty">Penalty</span>`
        : `<span class="pill ok">OK</span>`;
      return `<div class="cond">
        <b>${c.label}</b>
        <span class="num" style="color:${c.penalized ? "var(--rose)" : "var(--ink)"}">${fmtRatio(c.excessRatio)}</span>
        ${pill}
        <span class="muted">rank ${c.rank}/${c.peerCount} · state median ${fmtRatio(c.stateMedian)}</span>
        <span></span>
      </div>`;
    })
    .join("");

  root.innerHTML = `
    <section class="verdict">
      <div class="verdict-top">
        <div>
          <h2>${r.hospital.name}</h2>
          <div class="place">${r.hospital.county ? `${r.hospital.county} County, ` : ""}${r.hospital.state}</div>
        </div>
        ${penaltyBadge}
      </div>

      ${heroHtml}

      <section class="panel">
        <div class="section-head">
          <div>
            <h2 style="font-size:22px">All six HRRP conditions</h2>
            <p>CMS measures 30-day readmissions on these six. Ratio above 1.00 = worse than expected for your case mix.</p>
          </div>
          <span class="tag">CMS published</span>
        </div>
        ${rows}
      </section>

      <section class="panel export">
        <div class="section-head">
          <div>
            <h2 style="font-size:22px">One-pager for your leadership</h2>
            <p>CMS's numbers, framed. Copy it into an email or print it — the case is the source, not your opinion.</p>
          </div>
          <div class="button-row">
            <button class="button" type="button" id="copyOnePager">Copy</button>
            <button class="button" type="button" id="printOnePager">Print</button>
          </div>
        </div>
        <pre id="onePager">${onePager(r, shard)}</pre>
      </section>

      ${playbookPanel(targetCondition)}

      ${researchPanel()}

      <p class="lede" style="text-align:center;margin-top:8px">
        This is the public picture. The next step is running the same logic on your attributed panel —
        <a href="mailto:joel@enduranthealthspan.com?subject=Readmission%20pilot%20—%20${encodeURIComponent(r.hospital.name)}" style="font-weight:800;text-decoration:none;color:var(--blue-deep)">talk to Endurant about a pilot</a>.
      </p>
    </section>`;

  document
    .getElementById("copyOnePager")!
    .addEventListener("click", () => copyText(onePager(r, shard), "One-pager copied"));
  document.getElementById("printOnePager")!.addEventListener("click", () => window.print());

  // AI research action — one preset prompt, usable in any agent.
  const prompt = researchPrompt(r, manifest.hrrpPeriod);
  const links = researchLinks(prompt);
  document
    .getElementById("copyResearch")!
    .addEventListener("click", () =>
      copyText(prompt, "Research prompt copied — paste into Claude Code, Codex, or any AI"),
    );
  (document.getElementById("openChatgpt") as HTMLAnchorElement).href = links.chatgpt;
  (document.getElementById("openClaude") as HTMLAnchorElement).href = links.claude;
  (document.getElementById("openPerplexity") as HTMLAnchorElement).href = links.perplexity;
}

function limitedDataCard(r: BenchmarkResult, shard: HospitalRecord[]): string {
  const st = r.hospital.state;
  // Give them the state picture even though their own numbers are suppressed.
  const pairs: [ConditionKey, string][] = [
    ["HF", "heart failure"],
    ["COPD", "COPD"],
    ["PN", "pneumonia"],
  ];
  const context = pairs
    .map(([cond, label]) => {
      const sp = statePenaltyCount(shard, cond);
      if (sp.reported === 0) return "";
      return `<li><b>${sp.penalized} of ${sp.reported}</b><span>${st} hospitals are penalized on ${label}</span></li>`;
    })
    .filter(Boolean)
    .join("");

  return `<div class="hero" style="grid-template-columns:1fr">
    <div class="hero-copy">
      <h3>CMS doesn't publish readmission numbers for this hospital</h3>
      <p>Every HRRP measure here is suppressed — almost always because the hospital is small,
      critical-access, or specialty, with too few cases for CMS to report without risking patient privacy.
      That's not a clean bill of health; it means the public benchmark can't see you.</p>
      <p class="peers">Two ways to still get a real read: see how your state performs (below), and run the
      AI research action to pull your hospital's <b>current</b> standing from CMS Care Compare and state
      sources, which cover smaller facilities the HRRP file doesn't.</p>
      ${context ? `<ul class="summary-list" style="margin-top:14px">${context}</ul>` : ""}
    </div>
  </div>`;
}

function playbookPanel(condition: ConditionKey): string {
  const items = interventionsFor(condition)
    .map(
      (i) => `<li><b>${i.title}</b><span>${i.detail}</span></li>`,
    )
    .join("");
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2 style="font-size:22px">What the hospitals beating you do</h2>
          <p>Evidence-based moves that cut 30-day readmissions — and the billing that makes the program pay for itself.</p>
        </div>
        <span class="tag">Start here</span>
      </div>
      <ul class="plain-list">${items}</ul>
      <div class="memo-block" style="margin-top:18px;border-top:1px solid var(--line);padding-top:16px">
        <h3 style="margin-bottom:6px">${BILLING_NOTE.title}</h3>
        <p style="color:var(--muted);font-size:14px;margin:0 0 6px">${BILLING_NOTE.detail}</p>
        <p class="provenance" style="margin:0">${BILLING_NOTE.caveat}</p>
      </div>
      <p class="provenance" style="margin-top:14px">${SOURCES}</p>
    </section>`;
}

function researchPanel(): string {
  return `
    <section class="panel">
      <div class="section-head">
        <div>
          <h2 style="font-size:22px">Get what this data can't show — with your own AI</h2>
          <p>CMS data lags ~2 years. Run our preset research prompt, pre-loaded with this hospital's numbers, to surface the current penalty, what's changed since 2024, the 2026 rules, and an upgraded one-pager.</p>
        </div>
        <span class="tag">AI research</span>
      </div>
      <div class="button-row">
        <button class="button primary" type="button" id="copyResearch">Copy research prompt</button>
        <a class="button" id="openChatgpt" target="_blank" rel="noopener">Open in ChatGPT</a>
        <a class="button" id="openClaude" target="_blank" rel="noopener">Open in Claude</a>
        <a class="button" id="openPerplexity" target="_blank" rel="noopener">Open in Perplexity</a>
      </div>
      <p class="provenance" style="margin-top:12px">The copy button works in Claude Code, Codex, or any AI agent — it's a self-contained prompt with this hospital's CMS data built in.</p>
    </section>`;
}

function onePager(r: BenchmarkResult, shard: HospitalRecord[]): string {
  const lines: string[] = [
    `READMISSION REALITY CHECK — ${r.hospital.name}`,
    `${r.hospital.county ?? "?"} County, ${r.hospital.state}`,
    `Source: CMS Hospital Readmissions Reduction Program, ${manifest.hrrpPeriod.start}–${manifest.hrrpPeriod.end} (public, non-PHI).`,
    ``,
    r.penalizedCount > 0
      ? `We are in penalty territory on ${r.penalizedCount} of ${r.reportedCount} measured conditions.`
      : `We are not in penalty territory on any of the ${r.reportedCount} measured conditions.`,
    ``,
  ];
  for (const c of r.conditions) {
    if (c.suppressed) {
      lines.push(`- ${c.label}: CMS-suppressed (too few cases to report).`);
      continue;
    }
    const sp = statePenaltyCount(shard, c.condition);
    lines.push(
      `- ${c.label}: excess ratio ${fmtRatio(c.excessRatio)} (${pctVsExpected(c.excessRatio!)}). ` +
        `${c.penalized ? "PENALTY." : "OK."} Rank ${c.rank} of ${c.peerCount} in ${r.hospital.state} ` +
        `(state median ${fmtRatio(c.stateMedian)}; ${sp.penalized} of ${sp.reported} ${r.hospital.state} hospitals penalized on this condition).`,
    );
  }
  if (r.worst) {
    lines.push(
      ``,
      `Biggest gap vs. state peers: ${r.worst.label} — ${fmtRatio(r.worst.excessRatio)}, ` +
        `${fmtRatio(r.worst.gapToMedian)} above the ${r.hospital.state} median. Start the follow-through program here.`,
    );
  }
  lines.push(
    ``,
    `Note: excess readmission ratio is CMS's own risk-adjusted measure; >1.00 means more readmissions than expected for our case mix. This is public data, not a clinical or ROI claim.`,
  );
  return lines.join("\n");
}

// ---------- Toast / copy ----------

function showToast(message: string) {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout((showToast as unknown as { t: number }).t);
  (showToast as unknown as { t: number }).t = window.setTimeout(
    () => toast.classList.remove("show"),
    2200,
  );
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

loadData()
  .then(renderLanding)
  .catch((e) => {
    console.error(e);
    root.innerHTML = `<p class="lede" style="text-align:center">Could not load the CMS data snapshot. ${String(e)}</p>`;
  });
