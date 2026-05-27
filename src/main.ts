import "./styles.css";
import "./benchmark.css";
import type {
  ConditionKey,
  HospitalIndexEntry,
  HospitalProfile,
  HospitalRecord,
  SnapshotManifest,
} from "./lib/hrrp/types";
import { buildProfile } from "./lib/hrrp/profile";
import { statePenaltyCount } from "./lib/hrrp/benchmark";
import { researchPrompt, researchLinks } from "./lib/hrrp/research";
import { interventionsFor, BILLING_NOTE, SOURCES } from "./lib/hrrp/playbook";

declare global {
  interface Window {
    posthog?: { capture?: (event: string, props?: Record<string, unknown>) => void };
  }
}

// Web3Forms access key (public token tied to Joel's email). When empty, the
// contact form falls back to a mailto so no lead is ever lost.
// To enable in-app delivery: get a free key at web3forms.com and paste it here.
const CONTACT_KEY = "75f56baf-5462-4bc0-93e0-739ed3f15c72";
const CONTACT_EMAIL = "joel@enduranthealthspan.com";

const BASE = import.meta.env.BASE_URL;
const root = document.getElementById("root")!;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;

let index: HospitalIndexEntry[] = [];
let manifest: SnapshotManifest;
let currentProfile: HospitalProfile | null = null;

async function loadData() {
  const [m, idx] = await Promise.all([
    fetch(`${BASE}data/manifest.json`).then((r) => r.json()),
    fetch(`${BASE}data/hospitals.json`).then((r) => r.json()),
  ]);
  manifest = m;
  index = idx;
  document.getElementById("provenance")!.textContent =
    `Sources: CMS Hospital Readmissions Reduction Program (${manifest.sources.hrrp}), ` +
    `Unplanned Hospital Visits (${manifest.sources.unplanned}), and Hospital General Information ` +
    `(${manifest.sources.hospitals}). Public, non-PHI. ${manifest.counts.hospitals.toLocaleString()} hospitals.`;
}

// ---------- Landing ----------

function renderLanding() {
  restartBtn.hidden = true;
  root.innerHTML = `
    <section class="landing">
      <div class="eyebrow" style="justify-content:center">Care transitions intelligence</div>
      <h1>How are your readmissions really doing — and how do you compare?</h1>
      <p class="lede">CMS publishes your hospital's readmission performance across dozens of measures, but
      scattered and unranked. We assemble it: your freshest rates, how many of your patients come back, your
      penalty exposure, and where you stand against the hospitals next to you.</p>
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
            <b>${h.name}</b><span>${h.county ? `${h.county} County, ` : ""}${h.state}</span>
          </button>`,
      )
      .join("");
    results.querySelectorAll<HTMLButtonElement>(".result-item").forEach((btn) => {
      btn.addEventListener("click", () => selectHospital(btn.dataset.id!, btn.dataset.state!));
    });
  });
}

async function selectHospital(id: string, state: string) {
  root.innerHTML = `<p class="lede" style="text-align:center">Loading ${state} hospitals…</p>`;
  const shard: HospitalRecord[] = await fetch(`${BASE}data/states/${state}.json`).then((r) => r.json());
  currentProfile = buildProfile(id, shard);
  renderProfile(currentProfile, shard);
  window.posthog?.capture?.("hospital_benchmarked", { state, tier: currentProfile.tier });
}

// ---------- Profile / verdict ----------

function worseColor(worse: boolean | null): string {
  return worse === true ? "var(--rose)" : worse === false ? "var(--green)" : "var(--ink)";
}

function heroHtml(p: HospitalProfile, shard: HospitalRecord[]): string {
  const sp = statePenaltyCount(shard, "HF");
  const pervasive =
    sp.reported > 0
      ? `<p class="peers">In ${p.hospital.state}, <b>${sp.penalized} of ${sp.reported}</b> hospitals are penalized by CMS for heart-failure readmissions — you're not alone in this, but the benchmark is unforgiving.</p>`
      : "";

  if (p.headline.kind === "rate") {
    return `<div class="hero">
      <div class="ratio-big">
        <strong style="color:${worseColor(p.headline.worse)}">${p.headline.value}</strong>
        <small>${p.headline.asOf ?? ""}</small>
      </div>
      <div class="hero-copy">
        <h3>${p.headline.label}${p.headline.comparedToNational ? ` — ${p.headline.comparedToNational}` : ""}</h3>
        <p>This is the freshest readmission read CMS publishes for you${
          p.headline.worse ? ", and it's running worse than the national rate" : ""
        }. The penalty below is the lagged audit; this is closer to where you are now.</p>
        ${pervasive}
      </div>
    </div>`;
  }
  if (p.headline.kind === "rating") {
    const n = p.rating ?? 0;
    return `<div class="hero">
      <div class="ratio-big">
        <div class="stars">${"★".repeat(n)}${"☆".repeat(5 - n)}</div>
        <small>CMS overall rating</small>
      </div>
      <div class="hero-copy">
        <h3>${p.headline.value}</h3>
        <p>CMS doesn't publish enough readmission cases to score this hospital on the penalty program, but it
        does publish an overall quality rating. Use the measures below and your state's picture to find the gap.</p>
        ${pervasive}
      </div>
    </div>`;
  }
  // descriptor
  return `<div class="hero" style="grid-template-columns:1fr">
    <div class="hero-copy">
      <h3>${p.headline.label}</h3>
      <p>CMS publishes few comparative scores for this facility — typical for small, critical-access, or
      specialty hospitals below the reporting threshold. That's not a clean bill of health; the public benchmark
      can't see you. Use your state's picture below and the AI research action to pull your current standing.</p>
      ${pervasive}
    </div>
  </div>`;
}

function burdenHtml(p: HospitalProfile): string {
  if (!p.burden) return "";
  const denom = p.burden.denominator;
  return `<div class="burden">
    <div class="big">≈ ${p.burden.returned.toLocaleString()}</div>
    <p>That's roughly how many ${p.burden.label.toLowerCase()} patients came back to the hospital within 30 days${
      denom ? ` — out of ${denom.toLocaleString()} CMS counted` : ""
    } (${p.burden.asOf}). Every one is a patient your team did everything for, who still ended up back in a bed.</p>
  </div>`;
}

function recencyStrip(p: HospitalProfile): string {
  // Lead with the headline readmission measure (meaningful + recent), not the
  // literally-newest niche measure.
  if (p.headline.kind !== "rate" || !p.headline.asOf) return "";
  return `<div class="recency-strip">
    <span class="dot"></span>
    <span>Freshest read: <b>${p.headline.label} ${p.headline.value}</b>${
      p.headline.comparedToNational ? ` · ${p.headline.comparedToNational}` : ""
    }</span>
    <span class="asof">as of ${p.headline.asOf}</span>
  </div>`;
}

function auditBlock(p: HospitalProfile): string {
  const b = p.benchmark;
  if (b.reportedCount === 0) {
    return `<section class="panel">
      <div class="section-head">
        <div>
          <h2 style="font-size:22px">CMS penalty program (HRRP)</h2>
          <p>HRRP hasn't scored this hospital — typical for smaller or specialty facilities. The fresher measures above are the read you can act on.</p>
        </div>
        <span class="lag-chip">⏳ ~2-yr lag by law</span>
      </div>
    </section>`;
  }
  const rows = b.conditions
    .map((c) => {
      if (c.suppressed) {
        return `<div class="cond"><b>${c.label}</b><span class="num muted">—</span>
          <span class="pill suppressed">CMS-suppressed</span><span class="muted">too few cases</span><span></span></div>`;
      }
      const pill = c.penalized ? `<span class="pill penalty">Penalty</span>` : `<span class="pill ok">OK</span>`;
      return `<div class="cond"><b>${c.label}</b>
        <span class="num" style="color:${c.penalized ? "var(--rose)" : "var(--ink)"}">${c.excessRatio?.toFixed(2)}</span>
        ${pill}<span class="muted">rank ${c.rank}/${c.peerCount} · median ${c.stateMedian?.toFixed(2)}</span><span></span></div>`;
    })
    .join("");
  return `<section class="panel">
    <div class="section-head">
      <div>
        <h2 style="font-size:22px">The penalty: HRRP excess-readmission ratios</h2>
        <p>This is the regulatory proof — what CMS docks your Medicare payments on. Ratio above 1.00 = worse than expected for your case mix.</p>
      </div>
      <span class="lag-chip">⏳ CMS penalty cycle — ~2-yr lag by law</span>
    </div>
    ${rows}
    <p class="provenance" style="margin-top:12px">Penalized on ${b.penalizedCount} of ${b.reportedCount} measured conditions. Period ${manifest.hrrpPeriod.start}–${manifest.hrrpPeriod.end}.</p>
  </section>`;
}

function recencyPanel(p: HospitalProfile): string {
  if (p.recency.length === 0) return "";
  const rows = p.recency
    .map(
      (r) => `<div class="recency-row">
        <b>${r.label}</b>
        <span class="num" style="color:${worseColor(r.worse)}">${r.value}</span>
        <span class="muted">${r.comparedToNational ?? ""}</span>
        <span class="asof-chip">as of ${r.asOf}</span>
      </div>`,
    )
    .join("");
  return `<section class="panel">
    <div class="section-head">
      <div>
        <h2 style="font-size:22px">Your current readmission measures</h2>
        <p>The fresher CMS measures, each with its own measurement window. Newer than the penalty cycle.</p>
      </div>
      <span class="tag">CMS · latest</span>
    </div>
    <div class="recency-list">${rows}</div>
  </section>`;
}

function renderProfile(p: HospitalProfile, shard: HospitalRecord[]) {
  restartBtn.hidden = false;
  const targetCondition: ConditionKey = p.benchmark.worst?.condition ?? "HF";
  const badge =
    p.benchmark.penalizedCount > 0
      ? `<span class="badge penalty">⚠ Penalized on ${p.benchmark.penalizedCount} of ${p.benchmark.reportedCount} conditions</span>`
      : p.headline.worse
        ? `<span class="badge penalty">Running worse than the national rate</span>`
        : `<span class="badge ok">Holding at or better than national</span>`;

  root.innerHTML = `
    <section class="verdict">
      ${recencyStrip(p)}
      <div class="verdict-top">
        <div>
          <h2>${p.hospital.name}</h2>
          <div class="place">${p.hospital.county ? `${p.hospital.county} County, ` : ""}${p.hospital.state}</div>
        </div>
        ${badge}
      </div>

      ${heroHtml(p, shard)}
      ${burdenHtml(p)}
      ${recencyPanel(p)}
      ${auditBlock(p)}
      ${playbookPanel(targetCondition)}
      ${researchPanel()}

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
        <pre id="onePager">${onePager(p, shard)}</pre>
      </section>

      <div style="text-align:center;margin-top:8px">
        <button class="button primary" type="button" id="contactBtn" style="min-height:48px;padding:12px 28px">Talk to Endurant about a pilot</button>
        <p class="provenance" style="margin-top:8px">Run this same logic on your attributed panel.</p>
      </div>
    </section>`;

  document.getElementById("copyOnePager")!.addEventListener("click", () => copyText(onePager(p, shard), "One-pager copied"));
  document.getElementById("printOnePager")!.addEventListener("click", () => window.print());
  document.getElementById("contactBtn")!.addEventListener("click", openContactModal);

  const prompt = researchPrompt(p.benchmark, manifest.hrrpPeriod);
  const links = researchLinks(prompt);
  document
    .getElementById("copyResearch")!
    .addEventListener("click", () => copyText(prompt, "Research prompt copied — paste into Claude Code, Codex, or any AI"));
  (document.getElementById("openChatgpt") as HTMLAnchorElement).href = links.chatgpt;
  (document.getElementById("openClaude") as HTMLAnchorElement).href = links.claude;
  (document.getElementById("openPerplexity") as HTMLAnchorElement).href = links.perplexity;
}

function playbookPanel(condition: ConditionKey): string {
  const items = interventionsFor(condition).map((i) => `<li><b>${i.title}</b><span>${i.detail}</span></li>`).join("");
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
          <h2 style="font-size:22px">Research with AI</h2>
          <p>Go deeper and get the very latest. Run our preset prompt — pre-loaded with this hospital's numbers — to pull current performance, what's changed recently, the 2026 rules, and an upgraded one-pager.</p>
        </div>
        <span class="tag">AI · latest</span>
      </div>
      <div class="button-row">
        <button class="button primary" type="button" id="copyResearch">Copy research prompt</button>
        <a class="button" id="openChatgpt" target="_blank" rel="noopener">Open in ChatGPT</a>
        <a class="button" id="openClaude" target="_blank" rel="noopener">Open in Claude</a>
        <a class="button" id="openPerplexity" target="_blank" rel="noopener">Open in Perplexity</a>
      </div>
      <p class="provenance" style="margin-top:12px">The copy button works in Claude Code, Codex, or any AI agent — a self-contained prompt with this hospital's CMS data built in.</p>
    </section>`;
}

function onePager(p: HospitalProfile, shard: HospitalRecord[]): string {
  const lines: string[] = [
    `READMISSION REALITY CHECK — ${p.hospital.name}`,
    `${p.hospital.county ? `${p.hospital.county} County, ` : ""}${p.hospital.state}`,
    `Source: CMS public data (HRRP, Unplanned Hospital Visits, Hospital General Information). Non-PHI.`,
    ``,
  ];
  if (p.headline.kind === "rate") {
    lines.push(`Freshest read — ${p.headline.label}: ${p.headline.value}${p.headline.comparedToNational ? ` (${p.headline.comparedToNational})` : ""}, as of ${p.headline.asOf}.`);
  } else if (p.headline.kind === "rating") {
    lines.push(`CMS overall rating: ${p.headline.value}.`);
  }
  if (p.burden) {
    lines.push(`Burden: ≈ ${p.burden.returned.toLocaleString()} ${p.burden.label.toLowerCase()} patients came back within 30 days (${p.burden.asOf}).`);
  }
  if (p.recency.length) {
    lines.push(``, `Current measures:`);
    for (const r of p.recency) lines.push(`- ${r.label}: ${r.value}${r.comparedToNational ? ` (${r.comparedToNational})` : ""}, as of ${r.asOf}.`);
  }
  const b = p.benchmark;
  if (b.reportedCount > 0) {
    lines.push(``, `Penalty (HRRP, ${manifest.hrrpPeriod.start}–${manifest.hrrpPeriod.end}, lags ~2yr by law):`);
    lines.push(`Penalized on ${b.penalizedCount} of ${b.reportedCount} conditions.`);
    for (const c of b.conditions) {
      if (c.suppressed) continue;
      const sp = statePenaltyCount(shard, c.condition);
      lines.push(`- ${c.label}: excess ratio ${c.excessRatio?.toFixed(2)} ${c.penalized ? "(PENALTY)" : "(OK)"}, rank ${c.rank}/${c.peerCount} in ${p.hospital.state} (${sp.penalized}/${sp.reported} state hospitals penalized).`);
    }
  }
  lines.push(``, `Note: CMS's published, risk-adjusted public measures. Not a clinical or ROI claim.`);
  return lines.join("\n");
}

// ---------- Contact modal ----------

function buildContactModal() {
  const el = document.createElement("div");
  el.className = "role-gate";
  el.id = "contactModal";
  el.hidden = true;
  el.innerHTML = `
    <div class="role-card contact" role="dialog" aria-modal="true" aria-labelledby="contactTitle">
      <button class="modal-close" type="button" id="contactClose" aria-label="Close">×</button>
      <div class="eyebrow">Work with Endurant</div>
      <h2 id="contactTitle" style="font-size:24px;margin-bottom:6px">Run this on your real panel</h2>
      <p style="color:var(--muted);font-size:14px;margin-bottom:18px">Tell us where to reach you and we'll show you the same analysis on your attributed patients. No spam — only about a pilot.</p>
      <form id="contactForm">
        <input type="text" name="botcheck" class="hp" tabindex="-1" autocomplete="off">
        <div class="modal-field"><label for="cName">Name</label><input id="cName" name="name" type="text" required></div>
        <div class="modal-field"><label for="cEmail">Work email</label><input id="cEmail" name="email" type="email" required></div>
        <div class="modal-field"><label for="cNote">Anything you want us to know (optional)</label><textarea id="cNote" name="note"></textarea></div>
        <button class="button primary" type="submit" id="contactSubmit" style="width:100%;min-height:46px">Send</button>
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
  window.posthog?.capture?.("contact_opened", {
    hospital_ccn: currentProfile?.hospital.id,
    state: currentProfile?.hospital.state,
    tier: currentProfile?.tier,
  });
}

function closeContactModal() {
  document.getElementById("contactModal")!.hidden = true;
}

async function submitContact(e: Event) {
  e.preventDefault();
  const form = e.target as HTMLFormElement;
  const fd = new FormData(form);
  if (fd.get("botcheck")) return; // honeypot
  const name = String(fd.get("name") ?? "");
  const email = String(fd.get("email") ?? "");
  const note = String(fd.get("note") ?? "");
  const hospital = currentProfile ? `${currentProfile.hospital.name} (${currentProfile.hospital.id})` : "";

  const ok = () => {
    window.posthog?.capture?.("contact_submitted", {
      hospital_ccn: currentProfile?.hospital.id,
      state: currentProfile?.hospital.state,
      tier: currentProfile?.tier,
      has_note: note.length > 0,
    });
    closeContactModal();
    showToast("Thanks — we'll be in touch about a pilot.");
    form.reset();
  };

  if (CONTACT_KEY) {
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: CONTACT_KEY, name, email, hospital, message: note, subject: "Readmission Reality Check — pilot inquiry" }),
      });
      if (res.ok) return ok();
    } catch {
      /* fall through to mailto */
    }
  }
  // Fallback: open a prefilled email so the lead is never lost.
  const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nHospital: ${hospital}\n\n${note}`);
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=Readmission%20Reality%20Check%20—%20pilot&body=${body}`;
  ok();
}

// ---------- Toast / copy ----------

function showToast(message: string) {
  const toast = document.getElementById("toast")!;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout((showToast as unknown as { t: number }).t);
  (showToast as unknown as { t: number }).t = window.setTimeout(() => toast.classList.remove("show"), 2400);
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
buildContactModal();

loadData()
  .then(renderLanding)
  .catch((e) => {
    console.error(e);
    root.innerHTML = `<p class="lede" style="text-align:center">Could not load the CMS data snapshot. ${String(e)}</p>`;
  });
