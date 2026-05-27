// CMS uses sentinel strings for small-cell suppression. These must become
// null, never NaN, so every consumer is forced to handle missing data.

const SUPPRESSED = new Set([
  "n/a",
  "na",
  "not available",
  "too few to report",
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
