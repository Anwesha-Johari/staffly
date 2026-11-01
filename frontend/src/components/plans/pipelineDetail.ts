import type { LibraryQuery } from "@/lib/types";
import { analyzeSql } from "./sqlAnalysis";
import { flatten } from "./planUtils";

export type StageId = "parse" | "resolve" | "optimize" | "execute" | "storage";

export interface StageDetail {
  id: StageId;
  name: string;
  /** Generic explanation shown in the InfoTip. */
  tip: string;
  /** One short, query-specific line (max ~20 words). */
  line: string;
}

const STAGES: { id: StageId; name: string; tip: string }[] = [
  {
    id: "parse",
    name: "Parse",
    tip: "The SQL text is split into tokens and turned into a syntax tree. Only the shape is checked here, so a typo like SELCT fails now.",
  },
  {
    id: "resolve",
    name: "Resolve",
    tip: "Table and column names are looked up in the data dictionary. Unknown names and missing privileges are rejected here.",
  },
  {
    id: "optimize",
    name: "Optimize",
    tip: "The optimizer compares possible join orders and indexes, estimates each cost from index statistics, and keeps the cheapest plan.",
  },
  {
    id: "execute",
    name: "Execute",
    tip: "The plan runs as a tree of iterators. Each parent asks its children for the next row, so a LIMIT can stop the work early.",
  },
  {
    id: "storage",
    name: "Storage",
    tip: "InnoDB finds each page in the buffer pool and reads the disk only on a miss. Reads use snapshots (MVCC); writes take row locks.",
  },
];

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : /(s|x)$/.test(word) ? word + "es" : word + "s"}`;

export function buildStages(q: LibraryQuery): StageDetail[] {
  const a = analyzeSql(q.sql);
  const flat = flatten(q.plan);
  const accesses = flat.filter((f) => f.node.access && f.node.table);

  const parse = `${a.kind} with ${plural(a.clauses.length, "clause")}${
    a.placeholders ? `, ${plural(a.placeholders, "placeholder")}` : ""
  }${a.joins.length ? ` and ${plural(a.joins.length, "join")}` : ""} becomes a syntax tree.`;

  const resolve = `Looks up ${q.tables.join(", ")} in the data dictionary and checks the ${a.kind} privilege.`;

  const optimize = accesses.length
    ? `Picks ${accesses.map((f) => `${f.node.table} via ${f.node.access}`).join(", ")}.`
    : "Picks the cheapest plan from the declared indexes.";

  const execute = `${plural(flat.length, "step")} run bottom-up, starting with ${flat[flat.length - 1]?.node.op ?? "the first operator"}.`;

  const lock =
    a.kind === "SELECT"
      ? a.lock
        ? `${a.lock} takes row locks`
        : "a plain read uses a snapshot, no row locks"
      : a.kind === "INSERT"
        ? "the new row gets an exclusive lock"
        : "matched rows get exclusive locks";
  const storage = `${plural(accesses.length, "table access")} reach InnoDB; ${lock}.`;

  const lines: Record<StageId, string> = { parse, resolve, optimize, execute, storage };
  return STAGES.map((s) => ({ ...s, line: lines[s.id] }));
}
