import type { RoleId } from "../types";

export interface ChoiceOption {
  value: number;
  label: string;
}

export interface SelectField {
  id: keyof FactSelections;
  label: string;
  help?: string;
  options: ChoiceOption[];
  default: number;
}

/** The select/radio fields whose values feed the rule engine. */
export type FactSelections = {
  visibility: number;
  followup: number;
  meds: number;
  teachback: number;
  owner: number;
  closure: number;
  capacity: number;
};

export const roleOptions: { value: RoleId; label: string }[] = [
  { value: "aco", label: "ACO Medical Director" },
  { value: "pop", label: "VP Population Health" },
  { value: "operator", label: "Nurse Navigator / Care Manager" },
  { value: "medecon", label: "Medical Economics / CFO" },
];

export const countyOptions = [
  { value: "allegheny", label: "Allegheny County, PA" },
  { value: "wayne", label: "Wayne County, MI" },
  { value: "jefferson", label: "Jefferson County, AL" },
] as const;

/** Prioritization is rendered as a radio group; the rest are selects. */
export const prioritizationField: SelectField = {
  id: "visibility",
  label: "How are discharged HF patients prioritized?",
  default: 48,
  options: [
    { value: 20, label: "Diagnosis list or manual referral only" },
    { value: 48, label: "Risk list from EHR or claims, reviewed weekly" },
    { value: 74, label: "Risk list plus recent ED, meds, and social barriers" },
    { value: 92, label: "Daily queue with unresolved tasks and escalation state" },
  ],
};

export const selectFields: SelectField[] = [
  {
    id: "followup",
    label: "Expected first successful contact",
    default: 68,
    options: [
      { value: 22, label: "No clear SLA" },
      { value: 45, label: "Within 7 days" },
      { value: 68, label: "Within 72 hours" },
      { value: 86, label: "Within 48 hours, with escalation if missed" },
    ],
  },
  {
    id: "meds",
    label: "Medication access after discharge",
    default: 44,
    options: [
      { value: 20, label: "Not systematically tracked" },
      { value: 44, label: "Asked during callback" },
      { value: 72, label: "Tracked as a task with owner" },
      { value: 90, label: "Confirmed with pharmacy or patient before day 3" },
    ],
  },
  {
    id: "teachback",
    label: "Patient understanding of symptom thresholds",
    default: 50,
    options: [
      { value: 24, label: "Instructions given, no teach-back evidence" },
      { value: 50, label: "Teach-back script used when time allows" },
      { value: 76, label: "Teach-back documented as pass/fail" },
      { value: 92, label: "Teach-back failure automatically creates follow-up task" },
    ],
  },
  {
    id: "owner",
    label: "Who owns escalation?",
    default: 52,
    options: [
      { value: 24, label: "No single owner" },
      { value: 52, label: "Navigator decides case by case" },
      { value: 76, label: "Named clinical queue with response expectation" },
      { value: 92, label: "Named owner, SLA, backup path, and closure evidence" },
    ],
  },
  {
    id: "closure",
    label: "How is follow-through proven?",
    default: 44,
    options: [
      { value: 18, label: "Free-text notes and phone logs" },
      { value: 44, label: "EHR task status, not tied to outcome" },
      { value: 72, label: "Closed-loop task ledger for key post-discharge actions" },
      { value: 90, label: "Task closure tied to 7/14/30-day utilization review" },
    ],
  },
  {
    id: "capacity",
    label: "Navigator capacity for this workflow",
    help: "The score assumes capacity is the first constraint buyers underestimate.",
    default: 48,
    options: [
      { value: 25, label: "Already overloaded" },
      { value: 48, label: "Can handle current queue, misses spikes" },
      { value: 72, label: "Dedicated capacity for HF discharge follow-up" },
      { value: 88, label: "Dedicated capacity plus triage automation" },
    ],
  },
];

export const DISCHARGES_DEFAULT = 240;
export const DISCHARGES_MIN = 10;
export const DISCHARGES_MAX = 5000;

/** Build the default fact selections from the field definitions. */
export function defaultFactSelections(): FactSelections {
  const fields = [prioritizationField, ...selectFields];
  const out = {} as FactSelections;
  for (const f of fields) out[f.id] = f.default;
  return out;
}

/** Look up the human label for a numeric choice value within a field. */
export function labelForValue(field: SelectField, value: number): string {
  return field.options.find((o) => o.value === value)?.label ?? String(value);
}
