import type { Column, Table } from "@/lib/types";

/**
 * The parsed model does not carry charset/collation, but every CREATE TABLE in
 * database/schemas.sql declares the same table options, so they are modelled
 * here once and reused by the header chip and the reconstructed DDL.
 */
export const TABLE_CHARSET = "utf8mb4";
export const TABLE_COLLATION = "utf8mb4_0900_ai_ci";

function columnLine(c: Column): string {
  const parts = [c.name, c.type];
  if (c.generatedExpr) {
    parts.push(`GENERATED ALWAYS AS (${c.generatedExpr}) STORED`);
    return parts.join(" ");
  }
  if (!c.nullable) parts.push("NOT NULL");
  else if (c.type.startsWith("TIMESTAMP")) parts.push("NULL");
  if (c.defaultValue !== null) parts.push(`DEFAULT ${c.defaultValue}`);
  else if (c.nullable) parts.push("DEFAULT NULL");
  if (c.autoIncrement) parts.push("AUTO_INCREMENT");
  return parts.join(" ");
}

/** Rebuild a CREATE TABLE statement from the parsed model. */
export function buildDdl(t: Table): string {
  const lines: string[] = t.columns.map(columnLine);

  for (const ix of t.indexes) {
    if (!ix.explicit) continue; // implicit FK indexes are created by InnoDB, not declared
    const cols = ix.columns.join(", ");
    if (ix.kind === "PRIMARY") lines.push(`PRIMARY KEY (${cols})`);
    else if (ix.kind === "UNIQUE") lines.push(`UNIQUE KEY ${ix.name} (${cols})`);
    else lines.push(`KEY ${ix.name} (${cols})`);
  }
  for (const fk of t.foreignKeys) {
    lines.push(
      `CONSTRAINT ${fk.name} FOREIGN KEY (${fk.columns.join(", ")}) REFERENCES ${fk.refTable} (${fk.refColumns.join(", ")}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
    );
  }
  for (const ck of t.checks) {
    lines.push(`CONSTRAINT ${ck.name} CHECK (${ck.expression})`);
  }

  return (
    `CREATE TABLE ${t.name} (\n` +
    lines.map((l) => `  ${l}`).join(",\n") +
    `\n) ENGINE=${t.engine} DEFAULT CHARSET=${TABLE_CHARSET} COLLATE=${TABLE_COLLATION};`
  );
}

/* ---------- tiny SQL tokenizer for syntax highlighting ---------- */

export type TokenKind = "keyword" | "type" | "string" | "number" | "func" | "punct" | "ident" | "space";

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  "CREATE", "TABLE", "NOT", "NULL", "DEFAULT", "AUTO_INCREMENT", "PRIMARY", "KEY", "UNIQUE",
  "CONSTRAINT", "FOREIGN", "REFERENCES", "ON", "DELETE", "UPDATE", "CASCADE", "SET", "RESTRICT",
  "NO", "ACTION", "CHECK", "GENERATED", "ALWAYS", "AS", "STORED", "VIRTUAL", "ENGINE", "CHARSET",
  "COLLATE", "IN", "IS", "AND", "OR",
]);
const TYPES = new Set([
  "INT", "BIGINT", "SMALLINT", "TINYINT", "VARCHAR", "CHAR", "TEXT", "DECIMAL", "DATE", "TIME",
  "TIMESTAMP", "DATETIME", "BOOLEAN", "FLOAT", "DOUBLE",
]);
const FUNCS = new Set(["CURRENT_TIMESTAMP", "NOW"]);

export function tokenizeSql(sql: string): Token[] {
  const re = /(--[^\n]*)|('(?:[^']|'')*')|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|([\s\S])/g;
  const out: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    if (m[1]) out.push({ kind: "punct", text: m[1] });
    else if (m[2]) out.push({ kind: "string", text: m[2] });
    else if (m[3]) out.push({ kind: "number", text: m[3] });
    else if (m[4]) {
      const up = m[4].toUpperCase();
      const kind: TokenKind = FUNCS.has(up)
        ? "func"
        : TYPES.has(up)
          ? "type"
          : KEYWORDS.has(up)
            ? "keyword"
            : "ident";
      out.push({ kind, text: m[4] });
    } else if (m[5]) out.push({ kind: "space", text: m[5] });
    else out.push({ kind: "punct", text: m[6] });
  }
  return out;
}
