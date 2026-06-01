import type { BenchmarkResult, ConditionBenchmark } from "./types";

// The AI research action. One preset prompt, seeded with the hospital's real
// CMS data, usable in any agent (Claude Code, Codex, ChatGPT, Claude,
// Perplexity). It asks for exactly what the lagged CMS snapshot can't show and
// ends by regenerating an upgraded one-pager.

function conditionLine(c: ConditionBenchmark): string {
  if (c.suppressed) return `- ${c.label}: CMS-suppressed (too few cases)`;
  return (
    `- ${c.label}: excess ratio ${c.excessRatio?.toFixed(2)} ` +
    `(${c.penalized ? "PENALTY" : "OK"}), rank ${c.rank}/${c.peerCount} in state, ` +
    `state median ${c.stateMedian?.toFixed(2)}`
  );
}

/** Build the full, self-contained research prompt for a benchmarked hospital. */
export function researchPrompt(
  r: BenchmarkResult,
  period: { start: string; end: string },
  postAcuteSummary?: string,
): string {
  const worst = r.worst ? `${r.worst.label} (ratio ${r.worst.excessRatio?.toFixed(2)})` : "n/a";
  return [
    `You are a healthcare value-based-care and quality analyst with web search. I am building a post-discharge-gap case for a hospital — not just its readmission rate, but where its patients go after discharge and what happens in the unmonitored 30 days — and I need current context the latest CMS data cannot show.`,
    ``,
    `KNOWN BASELINE (CMS Hospital Readmissions Reduction Program, performance period ${period.start}–${period.end} — note this is the most recent CMS data and lags ~2 years by design; do not treat it as current):`,
    ``,
    `${r.hospital.name} — ${r.hospital.county ?? "?"} County, ${r.hospital.state} (CCN ${r.hospital.id})`,
    `Penalized on ${r.penalizedCount} of ${r.reportedCount} measured conditions. Biggest gap vs. state peers: ${worst}.`,
    ...r.conditions.map(conditionLine),
    postAcuteSummary ? `\nKNOWN POST-ACUTE CONTEXT (CMS public data): ${postAcuteSummary}.` : ``,
    r.reportedCount === 0
      ? `\nNOTE: CMS suppressed every HRRP measure for this hospital — likely a small, critical-access, or specialty facility below CMS's reporting threshold. Prioritize finding alternative CURRENT quality signals (Care Compare overall rating, state reports) since HRRP can't characterize it.`
      : ``,
    ``,
    `RESEARCH TASKS — do focused web research and cite every external claim with a link; separate verified fact from inference; never invent numbers:`,
    `1. CURRENT STANDING — how is this hospital doing RIGHT NOW overall? Most recent CMS Care Compare overall star rating; current 30-day readmission and mortality rates vs. the national rate; patient experience (HCAHPS); and the direction of travel (improving or worsening) over the last 2–3 years.`,
    `2. CURRENT CONSEQUENCE: this hospital's most recent HRRP payment-reduction percentage and fiscal year (CMS payment-adjustment file / Hospital Care Compare), plus any newer (2024–2026) CMS readmission results.`,
    `3. WHERE PATIENTS GO: this hospital's likely post-acute pathways — the skilled-nursing facilities and home-health agencies in ${r.hospital.county ?? "its"} County / ${r.hospital.state} that take its discharges, and how those facilities perform on 30-day rehospitalization and discharge-to-community (CMS SNF QRP, Home Health Compare). Which post-acute partners are the weakest links?`,
    `4. CROSS-FACILITY LEAKAGE: what share of 30-day readmissions in this market occur at a DIFFERENT hospital than the discharging one (AHRQ HCUP / CMS), and what that implies about the true post-discharge return rate vs. the hospital's own reported number.`,
    `5. WHAT'S COMING: 2025–2026 CMS regulatory changes affecting the post-discharge episode — the TEAM model (is this hospital in a mandatory CBSA?), IPPS/SNF/HH measure changes — and any ${r.hospital.state} Medicaid or state-level readmission programs.`,
    `6. WHAT WORKS: the 2–3 highest-evidence interventions to cut 30-day readmissions for ${worst} — distinguish what periodic touchpoints achieve from what continuous between-visit monitoring adds — with effect sizes and citations, plus the CURRENT Transitional Care Management billing values (CPT 99495/99496) so the program can be revenue-positive.`,
    `7. NEXT STEPS: 3–5 specific, impact-ordered moves a care-transitions leader can put in front of a VP or CFO to close the post-discharge gap.`,
    ``,
    `THEN: produce an upgraded one-page brief that merges the CMS baseline above with your current findings, leading with the size of the post-discharge gap (own rate + cross-facility leakage + post-acute performance) and how the hospital is doing now. This is non-PHI public analysis, not clinical advice.`,
  ].join("\n");
}

const enc = encodeURIComponent;

/** One-click deep-links that prefill the prompt in a web AI. */
export function researchLinks(prompt: string) {
  return {
    chatgpt: `https://chatgpt.com/?q=${enc(prompt)}`,
    claude: `https://claude.ai/new?q=${enc(prompt)}`,
    perplexity: `https://www.perplexity.ai/search?q=${enc(prompt)}`,
  };
}
