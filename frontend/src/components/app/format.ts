/** Small formatting helpers shared by dashboard pages. Dates are treated as UTC calendar dates. */

type DateLike = Date | string | null | undefined;

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 14 Mar 2026 */
export function formatDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** March 2026 (for a payroll month stored as YYYY-MM-01) */
export function formatMonth(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** 12,345.60 (no currency symbol: the schema does not define one) */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
