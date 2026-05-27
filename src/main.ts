import "./styles.css";
import type { Audience, AuditFacts, AuditResult, CountyId, RoleId } from "./types";
import { runAudit } from "./lib/scoring";
import { auditPackage, memoText, agentPrompt } from "./lib/exports";
import { audienceForRole } from "./data/roleViews";
import {
  roleOptions,
  countyOptions,
  prioritizationField,
  selectFields,
  defaultFactSelections,
  DISCHARGES_DEFAULT,
} from "./data/questions";
import { SUCCESS_MEASURES } from "./data/copy";

const roleBlurbs: Record<RoleId, string> = {
  aco: "You own total cost of care and the quality metrics.",
  pop: "You decide which programs get funded and scaled.",
  operator: "You run the discharge follow-up every day.",
  medecon: "You answer for utilization and spend.",
};

const PILOT_EMAIL =
  "mailto:joel@enduranthealthspan.com?subject=HF%20follow-up%20readiness%20pilot";

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreColor(score: number): string {
  if (score < 45) return "var(--rose)";
  if (score < 68) return "var(--amber)";
  if (score < 84) return "var(--blue)";
  return "var(--green)";
}

// ---------- Build the form from the data modules ----------

function buildSelect(el: HTMLSelectElement, options: { value: string; label: string }[]) {
  el.innerHTML = options
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join("");
}

function buildForm() {
  buildSelect($("role") as HTMLSelectElement, roleOptions.map((r) => ({ value: r.value, label: r.label })));
  buildSelect(
    $("county") as HTMLSelectElement,
    countyOptions.map((c) => ({ value: c.value, label: c.label })),
  );
  ($("discharges") as HTMLInputElement).value = String(DISCHARGES_DEFAULT);

  // Prioritization radios
  ($("prioritizationLabel") as HTMLElement).textContent = prioritizationField.label;
  const choices = $("prioritizationChoices") as HTMLElement;
  choices.innerHTML = prioritizationField.options
    .map(
      (o) => `
      <label class="choice">
        <input type="radio" name="visibility" value="${o.value}" ${
        o.value === prioritizationField.default ? "checked" : ""
      }>
        <span>${o.label}</span>
      </label>`,
    )
    .join("");

  // The rest of the selects
  const wrap = $("selectFields") as HTMLElement;
  wrap.innerHTML = selectFields
    .map((f) => {
      const opts = f.options
        .map(
          (o) =>
            `<option value="${o.value}" ${o.value === f.default ? "selected" : ""}>${o.label}</option>`,
        )
        .join("");
      const help = f.help ? `<small>${f.help}</small>` : "";
      return `
        <div class="field" style="margin-top:16px">
          <label for="${f.id}">${f.label}</label>
          <select id="${f.id}">${opts}</select>
          ${help}
        </div>`;
    })
    .join("");
}

// ---------- Read facts from the DOM ----------

function readFacts(): AuditFacts {
  const num = (id: string) => Number(($(id) as HTMLSelectElement | HTMLInputElement).value);
  const selections = defaultFactSelections();
  const visibility = Number(
    (document.querySelector('input[name="visibility"]:checked') as HTMLInputElement).value,
  );
  return {
    role: ($("role") as HTMLSelectElement).value as RoleId,
    county: ($("county") as HTMLSelectElement).value as CountyId,
    monthlyDischarges: clamp(num("discharges") || 0, 10, 5000),
    visibility,
    followup: num("followup") || selections.followup,
    meds: num("meds") || selections.meds,
    teachback: num("teachback") || selections.teachback,
    owner: num("owner") || selections.owner,
    closure: num("closure") || selections.closure,
    capacity: num("capacity") || selections.capacity,
  };
}

// ---------- Render ----------

let current: AuditResult;

function render() {
  current = runAudit(readFacts());
  renderSummary(current);
  renderDimensions(current);
  renderFailureMap(current);
  renderOperator(current);
  renderRiskOwner(current);
}

function renderSummary(r: AuditResult) {
  const ring = $("scoreRing")!;
  const color = scoreColor(r.score);
  ring.style.setProperty("--score", String(r.score));
  ring.style.background = `conic-gradient(${color} ${r.score}%, #e8f0f7 0)`;
  ($("scoreValue") as HTMLElement).textContent = String(r.score);

  const label = $("statusLabel")!;
  label.textContent = r.status.label;
  label.style.background =
    r.score < 45 ? "var(--surface-rose)" : r.score < 68 ? "#fff7e8" : r.score < 84 ? "var(--surface-blue)" : "var(--surface-green)";
  label.style.color =
    r.score < 45 ? "var(--rose)" : r.score < 68 ? "#9a5b0f" : r.score < 84 ? "var(--blue-deep)" : "var(--green)";

  ($("summaryHeadline") as HTMLElement).textContent = r.status.headline;
  ($("summaryCopy") as HTMLElement).textContent = r.status.copy;
  ($("firstBreak") as HTMLElement).textContent = r.firstBreak;
  ($("pilotWedge") as HTMLElement).textContent = r.pilotWedge;
  ($("proofTarget") as HTMLElement).textContent = r.proofTarget;
}

function renderDimensions(r: AuditResult) {
  ($("dimensions") as HTMLElement).innerHTML = r.dimensions
    .map(
      (d) => `
      <article class="dimension">
        <div class="dimension-head"><b>${d.label}</b><span>${d.score}/100</span></div>
        <div class="bar"><i style="width:${d.score}%; background:${scoreColor(d.score)}"></i></div>
        <p>${d.help}</p>
      </article>`,
    )
    .join("");
}

function renderFailureMap(r: AuditResult) {
  const html = r.failureMap
    .map(
      ({ day, title, body }) => `
      <article class="timeline-item">
        <div class="timeline-day">${day}</div>
        <div class="timeline-card"><strong>${title}</strong><p>${body}</p></div>
      </article>`,
    )
    .join("");
  for (const id of ["failureMap", "failureMapSecondary"]) {
    const el = $(id);
    if (el) el.innerHTML = html;
  }
}

function renderOperator(r: AuditResult) {
  const ov = $("operatorView");
  if (ov) ov.textContent = r.roleView.operator;
  const ps = $("operatorPublicSupport");
  if (ps) ps.textContent = `${r.county.context} ${r.county.support}`;
}

function renderRiskOwner(r: AuditResult) {
  const set = (id: string, text: string) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  set(
    "recommendation",
    r.score < 84
      ? `Run a focused HF discharge follow-through pilot in ${r.county.label}. Start with ${r.inputs.monthly_hf_discharges} monthly discharges and test the weakest operating dimension first: ${r.weakest.label.toLowerCase()}.`
      : `Use ${r.county.label} as a controlled follow-through pilot only if the goal is marginal lift, automation, or scale. The baseline workflow already appears structured.`,
  );
  set("memoWedge", r.pilotWedge);
  set("successMeasures", SUCCESS_MEASURES);
  set("buyerView", r.roleView.buyer);
  set("riskPublicSupport", `${r.county.context} ${r.county.support}`);
  set(
    "guardrail",
    "This public version creates a workflow hypothesis. It does not claim savings, avoidable readmissions, patient-level risk, or actual ROI without a contracted data feed.",
  );

  const dr = $("dataRequest");
  if (dr) {
    dr.innerHTML = auditPackage(r)
      .pilot_data_request.map(
        ({ category, fields }) => `<div class="data-row"><b>${category}</b><span>${fields}</span></div>`,
      )
      .join("");
  }

  const json = $("auditJson");
  if (json) json.textContent = JSON.stringify(auditPackage(r), null, 2);
}

// ---------- Audience / view ----------

function setAudience(audience: Audience) {
  document.body.dataset.audience = audience;
  ($("viewOperator") as HTMLButtonElement).setAttribute("aria-pressed", String(audience === "operator"));
  ($("viewRiskOwner") as HTMLButtonElement).setAttribute("aria-pressed", String(audience === "risk_owner"));

  const cta = $("primaryCta") as HTMLAnchorElement;
  const footerCta = $("footerCta") as HTMLAnchorElement;
  if (audience === "operator") {
    cta.textContent = "Build my brief";
    cta.setAttribute("href", "#audit-output");
    footerCta.textContent = "Send this to your risk owner";
    footerCta.setAttribute("href", "#audit-output");
  } else {
    cta.textContent = "Generate pilot brief";
    cta.setAttribute("href", "#pilotBrief");
    footerCta.textContent = "Run this on a real panel";
    footerCta.setAttribute("href", PILOT_EMAIL);
  }
}

// ---------- Role gate ----------

function buildRoleGate() {
  const wrap = $("roleOptions") as HTMLElement;
  wrap.innerHTML = roleOptions
    .map(
      (r) => `
      <button type="button" class="role-option" data-role="${r.value}">
        <b>${r.label}</b>
        <span>${roleBlurbs[r.value]}</span>
      </button>`,
    )
    .join("");

  wrap.querySelectorAll<HTMLButtonElement>(".role-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.dataset.role as RoleId;
      ($("role") as HTMLSelectElement).value = role;
      setAudience(audienceForRole(role));
      render();
      ($("roleGate") as HTMLElement).hidden = true;
    });
  });
}

// ---------- Copy helpers ----------

function showToast(message: string) {
  const toast = $("toast") as HTMLElement;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout((showToast as unknown as { t: number }).t);
  (showToast as unknown as { t: number }).t = window.setTimeout(
    () => toast.classList.remove("show"),
    2400,
  );
}

function copyText(text: string, message: string) {
  navigator.clipboard.writeText(text).then(
    () => showToast(message),
    () => {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      showToast(message);
    },
  );
}

// ---------- Init ----------

function init() {
  buildForm();
  buildRoleGate();
  setAudience("risk_owner");

  document.getElementById("auditForm")!.addEventListener("change", render);
  document.getElementById("auditForm")!.addEventListener("input", render);

  $("viewOperator")!.addEventListener("click", () => setAudience("operator"));
  $("viewRiskOwner")!.addEventListener("click", () => setAudience("risk_owner"));

  const bind = (id: string, fn: () => void) => $(id)?.addEventListener("click", fn);
  bind("copyMemo", () => copyText(memoText(current), "Pilot memo copied"));
  bind("copyMemoOperator", () => copyText(memoText(current), "One-page brief copied"));
  bind("copyJson", () => copyText(JSON.stringify(auditPackage(current), null, 2), "Audit JSON copied"));
  bind("copyAgentPrompt", () => copyText(agentPrompt(current), "Agent prompt copied"));

  render();
}

init();
