import type { AuditResult } from "../types";
import { dataRequest, CAVEATS, GUARDRAIL } from "../data/copy";

export interface AuditPackage {
  tool: string;
  use_case: string;
  inputs: Record<string, string | number>;
  readiness_score: number;
  weakest_dimension: string;
  second_weakest_dimension: string;
  first_likely_break: string;
  pilot_wedge: string;
  dimensions: { key: string; label: string; score: number; interpretation: string }[];
  failure_map_14_day: { day: string; title: string; body: string }[];
  pilot_data_request: { category: string; fields: string }[];
  caveats: string[];
}

/** Structured, PHI-free handoff artifact. Attachable to a ticket or an agent. */
export function auditPackage(result: AuditResult): AuditPackage {
  return {
    tool: "Heart Failure Follow-Up Readiness Audit",
    use_case: "Non-PHI workflow readiness check for post-discharge heart failure follow-up",
    inputs: result.inputs,
    readiness_score: result.score,
    weakest_dimension: result.weakest.label,
    second_weakest_dimension: result.secondWeakest.label,
    first_likely_break: result.firstBreak,
    pilot_wedge: result.pilotWedge,
    dimensions: result.dimensions.map((d) => ({
      key: d.key,
      label: d.label,
      score: d.score,
      interpretation: d.help,
    })),
    failure_map_14_day: result.failureMap.map(({ day, title, body }) => ({ day, title, body })),
    pilot_data_request: dataRequest,
    caveats: CAVEATS,
  };
}

/** Plain-text pilot memo a buyer can paste into email or a ticket. */
export function memoText(result: AuditResult): string {
  return [
    "Heart Failure Follow-Up Readiness Audit",
    "",
    `Geography: ${result.county.label}`,
    `User lens: ${result.inputs.role}`,
    `Monthly HF discharges: ${result.inputs.monthly_hf_discharges}`,
    `Readiness score: ${result.score}/100`,
    "",
    `Likely first break: ${result.firstBreak}`,
    `Best pilot wedge: ${result.pilotWedge}`,
    "",
    "Minimum contracted pilot data request:",
    ...dataRequest.map(({ category, fields }) => `- ${category}: ${fields}`),
    "",
    `Guardrail: ${GUARDRAIL}`,
  ].join("\n");
}

/** A ready-to-paste prompt that hands the audit package to any coding agent. */
export function agentPrompt(result: AuditResult): string {
  return [
    "Use the following non-PHI workflow audit package as context.",
    "Draft a 60-day heart-failure discharge follow-through pilot plan.",
    "Do not infer patient-level ROI, avoidable readmissions, or PHI.",
    "Return: pilot scope, implementation steps, data request, success metrics, risks, and buyer/operator framing.",
    "",
    JSON.stringify(auditPackage(result), null, 2),
  ].join("\n");
}
