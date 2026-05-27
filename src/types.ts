// Shared contract for the Heart Failure Follow-Up Readiness Audit.
// These types are the stable surface that the web UI, the CLI, and any
// future MCP server all depend on. Treat changes here as breaking.

export type RoleId = "aco" | "pop" | "operator" | "medecon";

/**
 * Two audiences drive the whole experience:
 * - "operator": the frontline (nurse navigator / care manager) who feels the
 *   pain daily but does not own the budget. Sees the operational diagnostic.
 * - "risk_owner": the buyer (VP Pop Health, ACO Medical Director, Med
 *   Economics / CFO) who owns the metric and the spend. Sees the economics.
 */
export type Audience = "operator" | "risk_owner";

export type CountyId = "allegheny" | "wayne" | "jefferson";

export type DimensionKey =
  | "visibility"
  | "capacity"
  | "ownership"
  | "comprehension"
  | "medication_access"
  | "measurement";

/** Raw operational facts. No PHI: team-level workflow answers only. */
export interface AuditFacts {
  role: RoleId;
  county: CountyId;
  monthlyDischarges: number;
  visibility: number;
  followup: number;
  meds: number;
  teachback: number;
  owner: number;
  closure: number;
  capacity: number;
}

export interface DimensionScore {
  key: DimensionKey;
  label: string;
  score: number;
  help: string;
}

export interface TimelineEntry {
  day: string;
  title: string;
  body: string;
}

export interface CountyContext {
  id: CountyId;
  label: string;
  context: string;
  support: string;
}

export interface RoleView {
  operator: string;
  buyer: string;
}

export interface AuditStatus {
  label: string;
  headline: string;
  copy: string;
}

/** The full computed result. This is also the shape of the JSON export. */
export interface AuditResult {
  score: number;
  status: AuditStatus;
  dimensions: DimensionScore[];
  weakest: DimensionScore;
  secondWeakest: DimensionScore;
  firstBreak: string;
  pilotWedge: string;
  proofTarget: string;
  failureMap: TimelineEntry[];
  county: CountyContext;
  roleView: RoleView;
  /** Default audience implied by the selected role; the UI may override it. */
  audience: Audience;
  inputs: Record<string, string | number>;
}
