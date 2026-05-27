import type { Audience, RoleId, RoleView } from "../types";

export const roleViews: Record<RoleId, RoleView> = {
  aco: {
    operator:
      "Operators need a queue that tells them which post-discharge promises are unresolved, not another prevalence map.",
    buyer:
      "The ACO buyer needs to know whether a 60-day pilot can prove follow-through work changed task closure and utilization signals.",
  },
  pop: {
    operator:
      "Care teams need fewer blind handoffs: who was reached, what failed, who owns escalation, and what remains unresolved.",
    buyer:
      "Population health leadership needs a defensible way to choose a narrow pilot segment before funding broader automation.",
  },
  operator: {
    operator:
      "The operator feels the pain directly: unclear priority, late callbacks, undocumented teach-back, and escalation decisions made under pressure.",
    buyer:
      "The buyer needs that pain translated into a measurable operating gap with a data request and pilot scope.",
  },
  medecon: {
    operator:
      "The front line needs proof that risk work is visible and owned before it becomes a readmission review.",
    buyer:
      "Medical economics needs this scoped tightly enough to test utilization signals without pretending public data proves ROI.",
  },
};

/**
 * The role a person selects implies a default audience (which view they land
 * on). Only the frontline role defaults to the operator view; everyone else
 * owns budget and lands on the risk-owner view. The UI lets them switch.
 */
export function audienceForRole(role: RoleId): Audience {
  return role === "operator" ? "operator" : "risk_owner";
}
