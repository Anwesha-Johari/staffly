import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  CheckConstraint,
  Column,
  FkAction,
  ForeignKey,
  SchemaModel,
  Table,
  TableIndex,
} from "./types";

const PURPOSE: Record<string, string> = {
  departments: "Organisational units. One row per department, referenced by employees.",
  job_roles: "Catalogue of job titles with an allowed salary band.",
  employees: "The central entity. Every other business table points back here.",
  user_accounts: "Login credentials and the access role (Admin, HR, Employee) for an employee.",
  attendance: "One row per employee per calendar day: check-in, check-out and status.",
  leave_requests: "Leave applications and their review outcome.",
  payroll: "One monthly pay record per employee, with a computed net salary.",
};

/** Split on commas that sit at parenthesis depth 0. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (const ch of body) {
    if (ch === "'") inString = !inString;
    if (!inString) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const idList = (s: string) => s.split(",").map((x) => x.replace(/[`\s]/g, "")).filter(Boolean);

/** Return the text inside the first balanced parentheses of `s`. */
function balanced(s: string): string {
  const start = s.indexOf("(");
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "(") depth++;
    if (s[i] === ")") {
      depth--;
      if (depth === 0) return s.slice(start + 1, i);
    }
  }
  return s.slice(start + 1);
}

function parseTable(name: string, body: string, tail: string, order: number): Table {
  const columns: Column[] = [];
  const indexes: TableIndex[] = [];
  const foreignKeys: ForeignKey[] = [];
  const checks: CheckConstraint[] = [];
  let primaryKey: string[] = [];

  for (const item of splitTopLevel(body)) {
    const line = item.replace(/\s+/g, " ").trim();

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^PRIMARY KEY \((.+)\)$/i))) {
      primaryKey = idList(m[1]);
      indexes.push({ name: "PRIMARY", kind: "PRIMARY", columns: primaryKey, explicit: true });
    } else if ((m = line.match(/^UNIQUE KEY (\w+) \((.+)\)$/i))) {
      indexes.push({ name: m[1], kind: "UNIQUE", columns: idList(m[2]), explicit: true });
    } else if ((m = line.match(/^KEY (\w+) \((.+)\)$/i))) {
      indexes.push({ name: m[1], kind: "INDEX", columns: idList(m[2]), explicit: true });
    } else if (/^CONSTRAINT \w+ FOREIGN KEY/i.test(line)) {
      m = line.match(
        /^CONSTRAINT (\w+) FOREIGN KEY \((.+?)\) REFERENCES (\w+) \((.+?)\)(?: ON DELETE (CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT))?(?: ON UPDATE (CASCADE|SET NULL|RESTRICT|NO ACTION|SET DEFAULT))?$/i,
      );
      if (m) {
        foreignKeys.push({
          name: m[1],
          table: name,
          columns: idList(m[2]),
          refTable: m[3],
          refColumns: idList(m[4]),
          onDelete: ((m[5] ?? "NO ACTION").toUpperCase() as FkAction),
          onUpdate: ((m[6] ?? "NO ACTION").toUpperCase() as FkAction),
          optional: false,
          oneToOne: false,
          selfReference: m[3] === name,
        });
      }
    } else if (/^CONSTRAINT \w+ CHECK/i.test(line)) {
      m = line.match(/^CONSTRAINT (\w+) CHECK/i);
      checks.push({ name: m![1], table: name, expression: balanced(line).replace(/\s+/g, " ").trim() });
    } else if ((m = line.match(/^(\w+) ([A-Za-z]+(?:\([^)]*\))?)(.*)$/))) {
      const rest = m[3];
      const def = rest.match(/DEFAULT ('[^']*'|[A-Za-z_]+(?:\(\))?|-?[\d.]+)/i);
      const gen = rest.match(/GENERATED ALWAYS AS/i) ? balanced(rest).replace(/\s+/g, " ").trim() : null;
      columns.push({
        name: m[1],
        type: m[2].toUpperCase(),
        nullable: !/NOT NULL/i.test(rest),
        defaultValue: def ? def[1] : /DEFAULT NULL/i.test(rest) ? null : null,
        autoIncrement: /AUTO_INCREMENT/i.test(rest),
        generatedExpr: gen,
        isPrimary: false,
        isUnique: false,
        fk: null,
      });
    }
  }

  // Derive column flags from the keys.
  for (const idx of indexes) {
    if (idx.kind === "UNIQUE" && idx.columns.length === 1) {
      const c = columns.find((x) => x.name === idx.columns[0]);
      if (c) c.isUnique = true;
    }
  }
  for (const c of columns) {
    if (primaryKey.includes(c.name)) {
      c.isPrimary = true;
      c.nullable = false;
    }
  }
  for (const fk of foreignKeys) {
    fk.optional = fk.columns.every((n) => columns.find((c) => c.name === n)?.nullable);
    fk.oneToOne = fk.columns.length === 1 && !!columns.find((c) => c.name === fk.columns[0])?.isUnique;
    fk.columns.forEach((colName, i) => {
      const c = columns.find((x) => x.name === colName);
      if (c) {
        c.fk = {
          constraint: fk.name,
          refTable: fk.refTable,
          refColumn: fk.refColumns[i],
          onDelete: fk.onDelete,
          onUpdate: fk.onUpdate,
        };
      }
    });
  }

  const engine = tail.match(/ENGINE=(\w+)/i)?.[1] ?? "InnoDB";

  return {
    name,
    order,
    purpose: PURPOSE[name] ?? "",
    engine,
    columns,
    primaryKey,
    indexes,
    foreignKeys,
    checks,
    referencedBy: [],
  };
}

export function parseSchema(sql: string, sourceFile: string): SchemaModel {
  const clean = sql.replace(/--.*$/gm, "");
  const database = clean.match(/USE\s+(\w+)\s*;/i)?.[1] ?? "employee_management";
  const tables: Table[] = [];

  const re = /CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < clean.length && depth > 0) {
      if (clean[i] === "(") depth++;
      if (clean[i] === ")") depth--;
      i++;
    }
    const body = clean.slice(bodyStart, i - 1);
    const tail = clean.slice(i, clean.indexOf(";", i));
    tables.push(parseTable(m[1], body, tail, tables.length + 1));
  }

  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      tables.find((x) => x.name === fk.refTable)?.referencedBy.push(fk);
    }
    // InnoDB creates an implicit index for every FK that has no usable index yet.
    for (const fk of t.foreignKeys) {
      const covered = t.indexes.some((ix) => fk.columns.every((c, i) => ix.columns[i] === c));
      if (!covered) {
        t.indexes.push({ name: fk.name, kind: "INDEX", columns: fk.columns, explicit: false });
      }
    }
  }

  const stats = {
    tables: tables.length,
    columns: tables.reduce((n, t) => n + t.columns.length, 0),
    primaryKeys: tables.filter((t) => t.primaryKey.length > 0).length,
    foreignKeys: tables.reduce((n, t) => n + t.foreignKeys.length, 0),
    checks: tables.reduce((n, t) => n + t.checks.length, 0),
    uniqueKeys: tables.reduce((n, t) => n + t.indexes.filter((x) => x.kind === "UNIQUE").length, 0),
    indexes: tables.reduce((n, t) => n + t.indexes.length, 0),
  };

  return { database, sourceFile, tables, stats };
}

/** Parse database/schemas.sql, the single source of truth for the dashboard. */
export async function loadSchema(): Promise<SchemaModel> {
  const candidates = [
    path.resolve(process.cwd(), "../database/schemas.sql"),
    path.resolve(process.cwd(), "database/schemas.sql"),
  ];
  for (const file of candidates) {
    try {
      const sql = await readFile(/*turbopackIgnore: true*/ file, "utf8");
      return parseSchema(sql, "database/schemas.sql");
    } catch {
      // try next candidate
    }
  }
  throw new Error("Could not find database/schemas.sql relative to " + process.cwd());
}
