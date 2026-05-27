import type { CountyContext, CountyId } from "../types";

// Public-data context only. These strings deliberately say what public
// datasets CAN frame (prevalence, Medicare FFS utilization, readmission
// signals) and refuse to imply attributed-patient or ROI claims.
export const counties: Record<CountyId, CountyContext> = {
  allegheny: {
    id: "allegheny",
    label: "Allegheny County, PA",
    context:
      "County-level chronic disease prevalence and Medicare FFS condition context are available from public CDC/CMS sources.",
    support:
      "Use public data to frame where HF burden and readmission pressure justify investigation. Do not infer your attributed panel from it.",
  },
  wayne: {
    id: "wayne",
    label: "Wayne County, MI",
    context:
      "Public sources can frame local chronic disease burden, Medicare FFS utilization context, and nearby hospital readmission signals.",
    support:
      "Use public data to make the pilot question concrete. The real opportunity depends on attributed lives, discharge feeds, and task outcomes.",
  },
  jefferson: {
    id: "jefferson",
    label: "Jefferson County, AL",
    context:
      "Public datasets can support geography-level context, but small cells and lagged releases limit precision.",
    support:
      "Use public data as a credible starting point, not as a substitute for claims, ADT, or care-management workflow data.",
  },
};
