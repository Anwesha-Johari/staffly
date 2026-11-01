import type { AccessType } from "@/lib/types";

export type Tone = "ok" | "info" | "warn" | "bad";

export const TONE_CHIP: Record<Tone, string> = {
  ok: "chip-ok",
  info: "chip-info",
  warn: "chip-warn",
  bad: "chip-bad",
};

export const TONE_BAR: Record<Tone, string> = {
  ok: "bg-ok",
  info: "bg-info",
  warn: "bg-warn",
  bad: "bg-bad",
};

export const ACCESS_META: Record<AccessType, { tone: Tone; tip: string }> = {
  const: { tone: "ok", tip: "At most one row, found through a primary or unique key. The cheapest access." },
  eq_ref: { tone: "ok", tip: "One matching row per row of the previous table, through a unique key." },
  ref: { tone: "ok", tip: "All rows with a given key value, read through an index. No table scan." },
  range: { tone: "info", tip: "A slice of an index, such as BETWEEN, a comparison or IN." },
  index: { tone: "warn", tip: "The whole index is read. Cheaper than a table scan, but still every entry." },
  ALL: { tone: "bad", tip: "A full table scan: every row is read. Fine for tiny tables, costly for big ones." },
};

export const ACCESS_ORDER = Object.keys(ACCESS_META) as AccessType[];

/** Square-root scale so 1 row and 10,000 rows can both be seen. */
export function barPct(rows: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(2, Math.round(Math.sqrt(Math.max(0, rows) / max) * 100));
}
