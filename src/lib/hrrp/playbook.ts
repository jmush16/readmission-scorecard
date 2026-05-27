import type { ConditionKey } from "./types";

// Evidence-based readmission-reduction guidance. Deliberately evergreen and
// sourced by name (not stale dollar figures or fast-changing regulations —
// those are routed to the AI research action). This is the "what the hospitals
// beating you actually do" layer.

export interface Intervention {
  title: string;
  detail: string;
}

/** Interventions that reduce 30-day readmissions across most conditions. */
export const CORE_BUNDLE: Intervention[] = [
  {
    title: "Follow-up visit within 7 days",
    detail:
      "A clinician follow-up within 7 days of discharge is one of the most consistent predictors of avoided readmission, especially for heart failure.",
  },
  {
    title: "48–72 hour outreach call",
    detail:
      "A structured phone call in the first 2–3 days catches medication, access, and symptom problems before they become an ED visit.",
  },
  {
    title: "Medication reconciliation",
    detail:
      "Reconcile and confirm the patient can obtain and afford their medications at discharge and again post-discharge — access failures drive predictable deterioration.",
  },
  {
    title: "Teach-back education",
    detail:
      "Confirm, with teach-back, that the patient understands their warning signs and what to do — documented as pass/fail, not just 'instructions given'.",
  },
];

/** Condition-specific additions for the hospital's worst condition. */
export const CONDITION_INTERVENTIONS: Record<ConditionKey, Intervention[]> = {
  HF: [
    { title: "Daily weight + diuretic self-management", detail: "Teach daily weights and a clear action plan for weight gain; titrate diuretics early." },
    { title: "Early GDMT optimization", detail: "Start and up-titrate guideline-directed medical therapy before and shortly after discharge." },
  ],
  COPD: [
    { title: "Inhaler technique + adherence", detail: "Verify inhaler technique and adherence; many readmissions trace to misuse." },
    { title: "Pulmonary rehab referral", detail: "Refer to pulmonary rehab and reinforce a written exacerbation action plan." },
  ],
  PN: [
    { title: "Vaccination + antibiotic completion", detail: "Confirm pneumococcal/flu vaccination status and that the full antibiotic course is completed." },
  ],
  AMI: [
    { title: "Cardiac rehab referral", detail: "Refer to cardiac rehab and confirm adherence to dual antiplatelet therapy and statins." },
  ],
  HIP_KNEE: [
    { title: "Structured rehab + wound pathway", detail: "Put patients on a defined PT/rehab pathway with proactive pain and wound management." },
  ],
  CABG: [
    { title: "Cardiac rehab + wound care", detail: "Refer to cardiac rehab and run a structured sternal-wound and medication follow-up." },
  ],
};

/** The billing unlock — turns follow-up work into Medicare revenue. */
export const BILLING_NOTE = {
  title: "Make the program pay for itself: Transitional Care Management",
  detail:
    "Medicare reimburses post-discharge management via Transitional Care Management codes (CPT 99495 / 99496): contact within 2 business days and a face-to-face visit within 7 or 14 days. Chronic Care Management (99490) and Principal Care Management can stack on top. This reframes the ask to leadership from 'spend money' to 'capture revenue while avoiding the penalty.'",
  caveat:
    "Payment amounts update annually — confirm the current values via CMS or the AI research action below.",
};

export const SOURCES =
  "Evidence base: AHRQ Care Transitions; Coleman Care Transitions Intervention; Naylor Transitional Care Model; Project RED (Re-Engineered Discharge); CMS Transitional Care Management.";

export function interventionsFor(condition: ConditionKey): Intervention[] {
  return [...CORE_BUNDLE, ...(CONDITION_INTERVENTIONS[condition] ?? [])];
}
