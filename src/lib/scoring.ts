import type { AuditFacts, AuditResult, DimensionScore } from "../types";
import { counties } from "../data/counties";
import { roleViews, audienceForRole } from "../data/roleViews";
import { buildFailureMap } from "../data/failureMap";
import {
  breakCopy,
  wedgeCopy,
  statusFor,
  PROOF_TARGET,
} from "../data/copy";
import {
  prioritizationField,
  selectFields,
  labelForValue,
  roleOptions,
  countyOptions,
  DISCHARGES_MIN,
  DISCHARGES_MAX,
} from "../data/questions";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Six readiness dimensions, derived from the raw facts. */
function computeDimensions(facts: AuditFacts): DimensionScore[] {
  const { visibility, followup, meds, teachback, owner, closure, capacity } = facts;
  const discharges = clamp(facts.monthlyDischarges || 0, DISCHARGES_MIN, DISCHARGES_MAX);

  // Higher volume strains a fixed team; very low volume relaxes it.
  const volumePressure = discharges > 500 ? 14 : discharges > 300 ? 8 : discharges < 80 ? -4 : 0;
  const adjustedCapacity = clamp(capacity - volumePressure, 12, 96);

  return [
    {
      key: "visibility",
      label: "Visibility",
      score: Math.round((visibility + meds + closure) / 3),
      help: "Can the team see who is at risk and which post-discharge promises are still open?",
    },
    {
      key: "capacity",
      label: "Capacity",
      score: adjustedCapacity,
      help: "Does the team have enough bandwidth to act before the callback window closes?",
    },
    {
      key: "ownership",
      label: "Ownership",
      score: Math.round((owner + followup) / 2),
      help: "Is there a named owner when a patient cannot be reached or a task fails?",
    },
    {
      key: "comprehension",
      label: "Comprehension",
      score: teachback,
      help: "Can the workflow prove the patient understood symptoms, thresholds, and next steps?",
    },
    {
      key: "medication_access",
      label: "Medication Access",
      score: meds,
      help: "Can the team confirm the patient has the medications the plan assumes they will take?",
    },
    {
      key: "measurement",
      label: "Measurement",
      score: Math.round((closure + visibility) / 2),
      help: "Can the pilot tie work performed to task closure and near-term utilization signals?",
    },
  ];
}

// Dimension weights, in the order produced by computeDimensions.
const WEIGHTS = [0.18, 0.16, 0.18, 0.16, 0.16, 0.16];

function labelForRole(role: AuditFacts["role"]): string {
  return roleOptions.find((r) => r.value === role)?.label ?? role;
}

/** Reconstruct the human-readable label for each fact, for export/memo. */
function describeInputs(facts: AuditFacts): Record<string, string | number> {
  const get = (id: (typeof selectFields)[number]["id"]) => {
    const field = selectFields.find((f) => f.id === id)!;
    return labelForValue(field, facts[id]);
  };
  return {
    role: labelForRole(facts.role),
    geography: counties[facts.county].label,
    monthly_hf_discharges: clamp(facts.monthlyDischarges, DISCHARGES_MIN, DISCHARGES_MAX),
    prioritization: labelForValue(prioritizationField, facts.visibility),
    first_contact_sla: get("followup"),
    medication_access: get("meds"),
    teachback: get("teachback"),
    escalation_owner: get("owner"),
    closure_evidence: get("closure"),
    navigator_capacity: get("capacity"),
  };
}

/**
 * Pure entry point. Raw facts in, full audit result out. No DOM, no IO.
 * This is the single source of truth shared by the web UI, the CLI, and any
 * future MCP server.
 */
export function runAudit(facts: AuditFacts): AuditResult {
  const dimensions = computeDimensions(facts);

  const weighted = dimensions.reduce((sum, d, i) => sum + d.score * WEIGHTS[i], 0);
  const score = Math.round(clamp(weighted, 0, 100));

  const ranked = [...dimensions].sort((a, b) => a.score - b.score);
  const weakest = ranked[0];
  const secondWeakest = ranked[1];

  return {
    score,
    status: statusFor(score),
    dimensions,
    weakest,
    secondWeakest,
    firstBreak: breakCopy[weakest.key],
    pilotWedge: wedgeCopy[weakest.key],
    proofTarget: PROOF_TARGET,
    failureMap: buildFailureMap(weakest.key, secondWeakest.key),
    county: counties[facts.county],
    roleView: roleViews[facts.role],
    audience: audienceForRole(facts.role),
    inputs: describeInputs(facts),
  };
}

export { countyOptions, roleOptions };
