import type { AuditStatus, DimensionKey } from "../types";

/** Plain-language "first likely break" per weakest dimension. */
export const breakCopy: Record<DimensionKey, string> = {
  visibility:
    "The team cannot reliably see which discharged patients still have unresolved follow-through tasks.",
  capacity:
    "The queue will overflow during volume spikes, so high-risk patients compete with routine callbacks.",
  ownership:
    "Escalation depends on individual judgment instead of a named owner, SLA, and backup path.",
  comprehension:
    "The plan assumes the patient understood symptom thresholds without durable evidence.",
  medication_access:
    "Medication access is not confirmed early enough to prevent a predictable deterioration loop.",
  measurement:
    "The team can document activity, but cannot cleanly prove which work closed and what happened next.",
};

/** The pilot wedge each weakest dimension points to. */
export const wedgeCopy: Record<DimensionKey, string> = {
  visibility:
    "Closed-loop HF discharge ledger showing every unresolved patient action by owner and day.",
  capacity:
    "Triage queue that ranks HF discharges by follow-through risk and protects navigator time.",
  ownership:
    "Escalation ownership map with response windows, backup path, and closure evidence.",
  comprehension:
    "Teach-back failure capture with symptom-threshold recall and automatic follow-up tasks.",
  medication_access:
    "Medication-access confirmation workflow before day 3, with escalation when access fails.",
  measurement:
    "Pilot outcome ledger connecting outreach, task closure, escalation, and 7/14/30-day signals.",
};

export const PROOF_TARGET =
  "Measure task closure, escalation time, and 7/14/30-day utilization signals on an attributed panel.";

/** Readiness band -> status messaging. Thresholds: <45, 45-67, 68-83, 84+. */
export function statusFor(score: number): AuditStatus {
  if (score < 45) {
    return {
      label: "High continuity risk",
      headline: "The workflow is likely to lose patients before anyone can intervene.",
      copy: "This is a strong pilot candidate, but the first phase should prove visibility and ownership before promising utilization impact.",
    };
  }
  if (score < 68) {
    return {
      label: "Pilot-worthy gap",
      headline: "The workflow can find some risk, but it cannot prove follow-through.",
      copy: "The opportunity is to turn callbacks and care instructions into a closed-loop operating system.",
    };
  }
  if (score < 84) {
    return {
      label: "Narrow pilot ready",
      headline: "The workflow has enough structure to test a focused follow-through pilot.",
      copy: "The next question is whether a live patient panel shows measurable gains in speed, closure, and escalation.",
    };
  }
  return {
    label: "Strong baseline",
    headline: "The workflow is unusually ready. The pilot should test marginal lift, not basic readiness.",
    copy: "The value may come from automation, scale, and patient-specific continuity rather than basic process repair.",
  };
}

/** Minimum data a contracted (compliant) pilot would need. */
export const dataRequest: { category: string; fields: string }[] = [
  ["Population", "HF discharge cohort, discharge date, discharge disposition, attribution status."],
  ["Workflow", "Outreach attempts, first successful contact, unresolved tasks, owner, escalation path."],
  ["Patient action", "Medication access confirmation, teach-back result, follow-up appointment completion."],
  ["Outcome window", "7/14/30-day ED visit, readmission, urgent symptom escalation, and task closure state."],
].map(([category, fields]) => ({ category, fields }));

export const CAVEATS = [
  "Use public and team-level workflow facts only in this demo.",
  "Public data can frame local context, but cannot identify attributed patients or prove ROI.",
  "Contracted pilots require compliant data access, attribution rules, and outcome definitions.",
  "This is workflow analysis, not medical advice or autonomous clinical decision support.",
];

export const GUARDRAIL =
  "This public version creates a workflow hypothesis. It does not claim savings, avoidable readmissions, patient-level risk, or actual ROI without a contracted data feed.";

export const SUCCESS_MEASURES =
  "Task closure rate, time to first successful contact, medication-access issue resolution, teach-back failure resolution, escalation response time, and 7/14/30-day ED or readmission signal.";
