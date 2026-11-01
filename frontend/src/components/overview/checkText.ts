import type { Table } from "@/lib/types";

/**
 * Turns a CHECK expression into a one-line English reading. It understands the
 * shapes MySQL CHECKs usually take (comparisons, IN lists, "x IS NULL OR ..."
 * guards, AND chains) and falls back to the raw expression otherwise.
 */

export const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function stripOuter(s: string): string {
  let e = s.trim();
  while (e.startsWith("(") && e.endsWith(")")) {
    let depth = 0;
    let closesAtEnd = true;
    for (let i = 0; i < e.length; i++) {
      if (e[i] === "(") depth++;
      if (e[i] === ")") depth--;
      if (depth === 0 && i < e.length - 1) {
        closesAtEnd = false;
        break;
      }
    }
    if (!closesAtEnd) break;
    e = e.slice(1, -1).trim();
  }
  return e;
}

/** Split on a keyword (AND / OR) that sits at parenthesis depth 0, outside quotes. */
function splitTop(s: string, kw: "AND" | "OR"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = false;
  let last = 0;
  const upper = s.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") quote = !quote;
    if (quote) continue;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (
      depth === 0 &&
      upper.startsWith(kw, i) &&
      /\s/.test(s[i - 1] ?? "") &&
      /\s/.test(s[i + kw.length] ?? "")
    ) {
      parts.push(s.slice(last, i));
      last = i + kw.length;
      i += kw.length - 1;
    }
  }
  parts.push(s.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

interface Atom {
  subject: string;
  predicate: string;
}

function atom(expr: string, table: Table): Atom | null {
  const e = stripOuter(expr);
  const inM = e.match(/^(.+?)\s+IN\s*\((.+)\)$/i);
  if (inM) {
    const values = inM[2].split(",").map((v) => v.trim().replace(/^_\w+/, "").replace(/\\?'/g, ""));
    return { subject: stripOuter(inM[1]), predicate: `must be one of ${values.join(", ")}` };
  }
  const m = e.match(/^(.+?)\s*(>=|<=|<>|!=|>|<|=)\s*(.+)$/);
  if (!m) return null;
  const subject = stripOuter(m[1]);
  const rhs = stripOuter(m[3]);
  const op = m[2];
  const col = table.columns.find((c) => c.name === subject);
  const temporal = !!col && /DATE|TIME/i.test(col.type);
  if (/^0(\.0+)?$/.test(rhs)) {
    if (op === ">=") return { subject, predicate: "cannot be negative" };
    if (op === ">") return { subject, predicate: "must be positive" };
  }
  const word: Record<string, string> = temporal
    ? {
        ">=": `must not be earlier than ${rhs}`,
        "<=": `must not be later than ${rhs}`,
        ">": `must be later than ${rhs}`,
        "<": `must be earlier than ${rhs}`,
        "=": `must equal ${rhs}`,
        "<>": `must differ from ${rhs}`,
        "!=": `must differ from ${rhs}`,
      }
    : {
        ">=": `must be at least ${rhs}`,
        "<=": `must be at most ${rhs}`,
        ">": `must be greater than ${rhs}`,
        "<": `must be less than ${rhs}`,
        "=": `must equal ${rhs}`,
        "<>": `must differ from ${rhs}`,
        "!=": `must differ from ${rhs}`,
      };
  return { subject, predicate: word[op] };
}

function clause(expr: string, table: Table): string {
  const e = stripOuter(expr);
  const ands = splitTop(e, "AND");
  if (ands.length > 1) return ands.map((p) => clause(p, table)).join("; ");

  const ors = splitTop(e, "OR");
  if (ors.length > 1) {
    const guardRe = /^(.+?)\s+IS\s+NULL$/i;
    const guards: string[] = [];
    const rest: string[] = [];
    for (const o of ors) {
      const g = stripOuter(o).match(guardRe);
      if (g) guards.push(stripOuter(g[1]));
      else rest.push(o);
    }
    if (guards.length && rest.length === 1) {
      const a = atom(rest[0], table);
      if (a) {
        if (guards.length === 1 && guards[0] === a.subject) return `${a.subject}, when set, ${a.predicate}`;
        const when = guards.length === 1 ? `${guards[0]} is set` : `${guards.join(" and ")} are both set`;
        return `when ${when}, ${a.subject} ${a.predicate}`;
      }
    }
    return `at least one of: ${ors.map(stripOuter).join(" | ")}`;
  }

  const a = atom(e, table);
  return a ? `${a.subject} ${a.predicate}` : `row must satisfy ${e}`;
}

export function readCheck(expression: string, table: Table): string {
  const text = clause(collapse(expression), table);
  return (/^(when|row) /.test(text) ? text.charAt(0).toUpperCase() + text.slice(1) : text) + ".";
}
