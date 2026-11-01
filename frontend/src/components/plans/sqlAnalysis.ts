export type StatementKind = "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";

export interface JoinInfo {
  type: string;
  table: string;
  alias: string | null;
  on: string;
}

export interface SqlAnalysis {
  kind: StatementKind;
  placeholders: number;
  /** Clause label and text, in the order they appear. */
  clauses: { label: string; text: string }[];
  /** WHERE conjuncts (split on top-level AND). */
  predicates: string[];
  joins: JoinInfo[];
  aliases: Record<string, string>;
  aggregates: string[];
  lock: string | null;
}

const CLAUSES = [
  "SELECT", "INSERT INTO", "UPDATE", "DELETE FROM", "FROM", "SET", "VALUES", "WHERE",
  "GROUP BY", "HAVING", "ORDER BY", "LIMIT", "ON DUPLICATE KEY UPDATE", "FOR UPDATE", "FOR SHARE",
];

/** Split text on a keyword matched by `re` at parenthesis depth 0 and outside quotes. */
function splitTop(text: string, re: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && (i === 0 || /\s/.test(text[i - 1]))) {
      const m = re.exec(text.slice(i));
      if (m && m.index === 0) {
        parts.push(text.slice(last, i));
        last = i + m[0].length;
        i = last - 1;
      }
    }
  }
  parts.push(text.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function findClauses(sql: string): { label: string; text: string }[] {
  const flat = sql.replace(/\s+/g, " ").trim().replace(/;$/, "");
  const found: { label: string; start: number; end: number }[] = [];
  let depth = 0;
  let quote: string | null = null;
  let skipUntil = 0;
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && i >= skipUntil && (i === 0 || flat[i - 1] === " ")) {
      const rest = flat.slice(i).toUpperCase();
      const hit = CLAUSES.filter((c) => rest === c || rest.startsWith(c + " ") || rest.startsWith(c + "("))
        .sort((a, b) => b.length - a.length)[0];
      if (hit) {
        found.push({ label: hit, start: i, end: i + hit.length });
        skipUntil = i + hit.length;
      }
    }
  }
  return found.map((c, idx) => ({
    label: c.label,
    text: flat.slice(c.end, idx + 1 < found.length ? found[idx + 1].start : undefined).trim(),
  }));
}

export function analyzeSql(sql: string): SqlAnalysis {
  const clauses = findClauses(sql);
  const first = clauses[0]?.label ?? "";
  const kind: StatementKind =
    first === "SELECT" ? "SELECT" : first === "INSERT INTO" ? "INSERT" : first === "UPDATE" ? "UPDATE" : first === "DELETE FROM" ? "DELETE" : "OTHER";

  const get = (l: string) => clauses.find((c) => c.label === l)?.text ?? "";
  const source = kind === "SELECT" ? get("FROM") : kind === "DELETE" ? get("DELETE FROM") : kind === "UPDATE" ? get("UPDATE") : "";

  const aliases: Record<string, string> = {};
  const joins: JoinInfo[] = [];
  if (source) {
    const joinRe = /^(?:(?:LEFT|RIGHT|INNER|CROSS)\s+(?:OUTER\s+)?)?JOIN\b/i;
    const pieces = splitTop(source, joinRe);
    const joinWords = [...source.matchAll(/\b((?:LEFT|RIGHT|INNER|CROSS)\s+(?:OUTER\s+)?)?JOIN\b/gi)].map((m) =>
      ((m[1] ?? "") + "JOIN").replace(/\s+/g, " ").toUpperCase(),
    );
    pieces.forEach((p, i) => {
      const [tablePart, ...onPart] = p.split(/\bON\b/i);
      const m = tablePart.trim().match(/^`?(\w+)`?(?:\s+(?:AS\s+)?`?(\w+)`?)?/i);
      if (!m) return;
      const alias = m[2] ?? null;
      if (alias) aliases[alias] = m[1];
      aliases[m[1]] = m[1];
      if (i > 0) joins.push({ type: joinWords[i - 1] ?? "JOIN", table: m[1], alias, on: onPart.join("ON").trim() });
    });
  }

  const where = get("WHERE");
  const predicates = where ? splitTop(where, /^AND\b/i) : [];
  const aggregates = [
    ...new Set([...get("SELECT").matchAll(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/gi)].map((m) => m[1].toUpperCase())),
  ];
  const lock = clauses.find((c) => c.label === "FOR UPDATE" || c.label === "FOR SHARE")?.label ?? null;

  return {
    kind,
    placeholders: (sql.match(/%s|\?/g) ?? []).length,
    clauses,
    predicates,
    joins,
    aliases,
    aggregates,
    lock,
  };
}
