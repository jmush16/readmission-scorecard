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
export function researchPrompt(r: BenchmarkResult, period: { start: string; end: string }): string {
  const worst = r.worst ? `${r.worst.label} (ratio ${r.worst.excessRatio?.toFixed(2)})` : "n/a";
  return [
    `You are a healthcare value-based-care and quality analyst with web search. I am building a readmissions-improvement case for a hospital and need current context that the latest CMS data cannot show.`,
    ``,
    `KNOWN BASELINE (CMS Hospital Readmissions Reduction Program, performance period ${period.start}–${period.end} — note this is the most recent CMS data and lags ~2 years by design; do not treat it as current):`,
    ``,
    `${r.hospital.name} — ${r.hospital.county ?? "?"} County, ${r.hospital.state} (CCN ${r.hospital.id})`,
    `Penalized on ${r.penalizedCount} of ${r.reportedCount} measured conditions. Biggest gap vs. state peers: ${worst}.`,
    ...r.conditions.map(conditionLine),
    ``,
    `RESEARCH TASKS — do focused web research and cite every external claim with a link; separate verified fact from inference; never invent numbers:`,
    `1. CURRENT CONSEQUENCE: this hospital's most recent HRRP payment-reduction percentage and fiscal year (CMS payment-adjustment file / Hospital Care Compare), plus any newer (2024–2026) CMS readmission or quality results for it.`,
    `2. WHAT CHANGED HERE since 2024: new transitional-care or readmission-reduction programs, care-management leadership hires, quality awards or citations, recent local news. Flag anything you cannot verify.`,
    `3. WHAT'S COMING: 2025–2026 CMS regulatory changes affecting readmissions — the TEAM model (is this hospital in a mandatory CBSA?), IPPS measure changes — and any ${r.hospital.state} Medicaid or state-level readmission programs.`,
    `4. WHAT WORKS: the 2–3 highest-evidence interventions to cut 30-day readmissions for ${worst}, with effect sizes and citations, and the CURRENT Transitional Care Management billing values (CPT 99495/99496) so the program can be revenue-positive.`,
    `5. NEXT STEPS: 3–5 specific, impact-ordered moves a care-transitions leader can put in front of a VP or CFO.`,
    ``,
    `THEN: produce an upgraded one-page brief that merges the CMS baseline above with your current findings, suitable to hand to leadership. This is non-PHI public analysis, not clinical advice.`,
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
