import type { DimensionKey, TimelineEntry } from "../types";

/**
 * The 14-day failure map adapts its day-2/4/7/14 narrative to the two weakest
 * dimensions, so the synthetic stress test reflects the team's actual gap.
 */
export function buildFailureMap(
  weakest: DimensionKey,
  second: DimensionKey,
): TimelineEntry[] {
  const day2 =
    weakest === "capacity"
      ? "Navigator queue begins to overflow, and the sickest patients are not necessarily the first handled."
      : weakest === "visibility"
        ? "The team does not know which patients still lack a successful contact or unresolved task owner."
        : "The first contact window depends on manual judgment and local memory.";

  const day4 =
    weakest === "medication_access" || second === "medication_access"
      ? "Medication access problem remains hidden until symptoms worsen or the patient gives up on the plan."
      : "The plan assumes medication access, transportation, and symptom recognition are already solved.";

  const day7 =
    weakest === "comprehension" || second === "comprehension"
      ? "The patient may not know which symptom change should trigger a call, urgent visit, or medication adjustment."
      : weakest === "ownership" || second === "ownership"
        ? "A failed outreach attempt creates ambiguity: who owns escalation, and by when?"
        : "Routine documentation makes the work look complete even when patient follow-through is unresolved.";

  const day14 =
    weakest === "measurement" || second === "measurement"
      ? "The team cannot reconstruct which actions closed the loop and which failures preceded utilization."
      : "The episode becomes a retrospective readmission review instead of a visible, owned follow-through workflow.";

  return [
    {
      day: "Day 0",
      title: "The discharge plan sounds complete.",
      body: "Instructions, meds, appointments, and warning signs exist on paper. The audit asks whether the workflow can prove they survive contact with real life.",
    },
    { day: "Day 2", title: "First contact window exposes the operating model.", body: day2 },
    { day: "Day 4", title: "Medication and access assumptions become clinical risk.", body: day4 },
    { day: "Day 7", title: "Ownership and comprehension decide whether risk escalates.", body: day7 },
    { day: "Day 14", title: "The system either has a closed-loop record or a story.", body: day14 },
  ];
}
