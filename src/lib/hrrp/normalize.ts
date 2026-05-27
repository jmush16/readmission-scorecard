// CMS uses sentinel strings for small-cell suppression. These must become
// null, never NaN, so every consumer is forced to handle missing data.

const SUPPRESSED = new Set([
  "n/a",
  "na",
  "not available",
  "too few to report",
  "number of cases too small",
  "not applicable",
  "",
]);

/** Parse a CMS numeric field. Suppressed / non-numeric values -> null. */
export function num(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (SUPPRESSED.has(s.toLowerCase())) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Median over the provided numbers; null if empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Round to n decimals (avoids float noise in displayed gaps). */
export function round(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "07/01/2023" -> "Jul 2023". Tolerant of missing/odd input. */
function monthYear(date: string | undefined): string {
  if (!date) return "";
  const [mm, , yyyy] = date.split("/");
  const m = Number(mm);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${yyyy}` : date;
}

/** "Jul 2023 – Jun 2024" from a CMS start/end pair. */
export function formatPeriod(period: { start: string; end: string }): string {
  const a = monthYear(period.start);
  const b = monthYear(period.end);
  return a && b ? `${a} – ${b}` : a || b || "—";
}
