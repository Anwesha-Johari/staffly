import type { Column, ForeignKey, Table } from "@/lib/types";

/* Pure helpers that turn parsed schema facts into plain English. */

/** Remove redundant outer parentheses: "((a + b))" -> "a + b". */
export function stripOuterParens(s: string): string {
  let t = s.trim();
  while (t.startsWith("(") && t.endsWith(")") && wraps(t)) t = t.slice(1, -1).trim();
  return t;
}

/** True when the opening paren at index 0 closes at the very end. */
function wraps(t: string): boolean {
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (ch === "(") depth++;
    if (ch === ")") {
      depth--;
      if (depth === 0 && i < t.length - 1) return false;
    }
  }
  return true;
}

/** Split on a top-level boolean keyword (AND / OR), outside parens and strings. */
function splitTop(s: string, kw: "AND" | "OR"): string[] {
  const re = new RegExp(`\\s+${kw}\\s+`, "iy");
  const parts: string[] = [];
  let depth = 0;
  let inStr = false;
  let last = 0;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'") inStr = !inStr;
    if (!inStr) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (depth === 0) {
        re.lastIndex = i;
        const m = re.exec(s);
        if (m) {
          parts.push(s.slice(last, i));
          i += m[0].length;
          last = i;
          continue;
        }
      }
    }
    i++;
  }
  parts.push(s.slice(last));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function joinList(items: string[], word: "and" | "or"): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} ${word} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, ${word} ${items[items.length - 1]}`;
}

const CMP: Record<string, string> = {
  ">=": "at least",
  "<=": "at most",
  ">": "greater than",
  "<": "less than",
  "=": "equal to",
  "<>": "different from",
  "!=": "different from",
};

function clause(raw: string): string {
  const c = stripOuterParens(raw);

  const ors = splitTop(c, "OR");
  if (ors.length > 1) {
    const nulls: string[] = [];
    const rest: string[] = [];
    for (const o of ors) {
      const m = stripOuterParens(o).match(/^(\S+) IS NULL$/i);
      if (m) nulls.push(m[1]);
      else rest.push(clause(o));
    }
    if (nulls.length && rest.length) {
      const who = nulls.length === 1 ? `${nulls[0]} is` : `${joinList(nulls, "or")} is`;
      const lead = nulls.length > 1 ? `If either ${nulls.join(" or ")} is NULL` : `If ${who} NULL`;
      return `${lead} the rule does not apply; otherwise ${joinList(rest, "or")}`;
    }
    return joinList(rest.concat(nulls.map((n) => `${n} is NULL`)), "or");
  }

  const ands = splitTop(c, "AND");
  if (ands.length > 1) return joinList(ands.map(clause), "and");

  let m = c.match(/^(.+?) NOT IN \((.+)\)$/i);
  if (m) return `${stripOuterParens(m[1])} must not be ${joinList(m[2].split(/\s*,\s*/), "or")}`;
  m = c.match(/^(.+?) IN \((.+)\)$/i);
  if (m) return `${stripOuterParens(m[1])} must be one of ${m[2].split(/\s*,\s*/).join(", ")}`;
  m = c.match(/^(.+?) IS NOT NULL$/i);
  if (m) return `${stripOuterParens(m[1])} must not be NULL`;
  m = c.match(/^(.+?) IS NULL$/i);
  if (m) return `${stripOuterParens(m[1])} must be NULL`;
  m = c.match(/^(.+?) (>=|<=|<>|!=|>|<|=) (.+)$/);
  if (m) return `${stripOuterParens(m[1])} must be ${CMP[m[2]]} ${stripOuterParens(m[3])}`;
  return c;
}

/** One plain-English sentence per top-level AND term of a CHECK expression. */
export function explainCheck(expression: string): string[] {
  const terms = splitTop(stripOuterParens(expression), "AND");
  return terms.map((t) => {
    const s = clause(t);
    return `${s}.`; // identifiers lead most sentences, so keep their case
  });
}

/** Explain what a foreign key's ON DELETE / ON UPDATE action does, for this FK. */
export function fkActionText(kind: "delete" | "update", fk: ForeignKey): string {
  const child = fk.selfReference ? `other ${fk.table} rows` : `${fk.table} rows`;
  const parent = fk.refTable;
  const cols = fk.columns.join(", ");
  const action = kind === "delete" ? fk.onDelete : fk.onUpdate;
  const subject =
    kind === "delete"
      ? `Deleting a ${parent} row`
      : `Changing ${fk.refColumns.join(", ")} in a ${parent} row`;
  switch (action) {
    case "CASCADE":
      return kind === "delete"
        ? `${subject} also deletes every one of the ${child} that reference it.`
        : `${subject} rewrites ${cols} in every one of the ${child} that reference it, so the link follows the new value.`;
    case "SET NULL":
      return `${subject} sets ${cols} to NULL in the ${child} that referenced it. Those rows survive but lose the link.`;
    case "SET DEFAULT":
      return `${subject} would reset ${cols} to its default. InnoDB parses this clause but refuses to create such a key.`;
    default:
      return `${subject} is refused while ${child} still reference it. The statement fails with error 1451 and nothing changes.`;
  }
}

/** One plain-English phrase for what a column holds, built from its definition. */
export function describeColumn(table: Table, col: Column): string {
  if (col.generatedExpr) return `Calculated by MySQL: ${stripOuterParens(col.generatedExpr)}. The app never writes it.`;
  if (col.isPrimary && col.autoIncrement) return "Unique number for each row, filled in automatically.";
  if (col.isPrimary) return "Unique value for each row.";
  if (col.fk) {
    const fk = table.foreignKeys.find((f) => f.columns.includes(col.name));
    const where = `${col.fk.refTable}.${col.fk.refColumn}`;
    if (fk?.selfReference) return `Points to another row of this table (${where}).${col.nullable ? " Optional." : ""}`;
    return `Points to a row in ${col.fk.refTable} (${where}).${col.nullable ? " Optional." : " Required."}`;
  }
  const check = table.checks.find((c) => new RegExp(`\\b${col.name}\\b`).test(c.expression));
  const t = col.type.toUpperCase();
  let what = "Text";
  if (/^(INT|BIGINT|SMALLINT|TINYINT)/.test(t)) what = "Whole number";
  else if (/^DECIMAL|^NUMERIC|^FLOAT|^DOUBLE/.test(t)) what = "Amount with decimals";
  else if (/^DATETIME|^TIMESTAMP/.test(t)) what = "Date and time";
  else if (/^DATE/.test(t)) what = "Date";
  else if (/^TIME/.test(t)) what = "Time of day";
  const extras: string[] = [];
  if (col.isUnique) extras.push("no two rows may share it");
  if (!col.nullable) extras.push("required");
  else extras.push("optional");
  if (col.defaultValue && col.defaultValue !== "NULL") extras.push(`defaults to ${col.defaultValue.replace(/'/g, "")}`);
  if (check) extras.push("limited by a CHECK rule");
  return `${what}; ${extras.join(", ")}.`;
}
