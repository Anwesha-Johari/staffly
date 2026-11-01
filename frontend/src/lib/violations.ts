/**
 * "Why can't I...?" scenarios.
 *
 * Every scenario names a constraint from database/schemas.sql. Nothing here is
 * trusted blindly: `resolveScenario` re-checks each constraint name, column and
 * referential action against the parsed SchemaModel at render time and builds
 * the DDL snippet and the MySQL error text from the parsed schema. If the DDL
 * has drifted from what a scenario claims, the scenario is flagged instead of
 * showing a made-up error.
 */
import type { FkAction, ForeignKey, SchemaModel, Table } from "./types";

export type ConstraintKind = "CHECK" | "UNIQUE" | "FOREIGN KEY" | "NOT NULL" | "GENERATED" | "SET NULL";

export type StepId = "app" | "column" | "constraint" | "result";

export const STEPS: { id: StepId; label: string }[] = [
  { id: "app", label: "App check" },
  { id: "column", label: "Column rules" },
  { id: "constraint", label: "Constraint check" },
  { id: "result", label: "Result" },
];

export type ConstraintRef =
  | { type: "check"; table: string; name: string }
  | { type: "unique"; table: string; name: string; columns: string[] }
  | { type: "fk"; table: string; name: string; columns: string[]; refTable: string }
  | { type: "notnull"; table: string; column: string }
  | { type: "generated"; table: string; column: string };

export interface Scenario {
  id: string;
  /** Short plain title for the list. */
  title: string;
  kind: ConstraintKind;
  sql: string;
  constraint: ConstraintRef;
  outcome: "rejected" | "succeeds";
  /** Step where MySQL stops a rejected statement (ignored when it succeeds). */
  failStep: "column" | "constraint";
  /** Value placed inside "Duplicate entry '<v>'" for UNIQUE scenarios. */
  dupValue?: string;
  /** One short sentence about what MySQL saw. */
  summary: string;
  /** What the Python app does in this situation (shown in the App check InfoTip). */
  appTip: string;
  /** One-line fix. */
  fix: string;
  /** For ON DELETE scenarios: the foreign key that fires, checked against the DDL. */
  action?: { table: string; fk: string; onDelete: FkAction };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "negative-salary",
    title: "Negative salary",
    kind: "CHECK",
    sql: "UPDATE employees\nSET salary = -500.00\nWHERE employee_id = 2;",
    constraint: { type: "check", table: "employees", name: "chk_employee_salary" },
    outcome: "rejected",
    failStep: "constraint",
    summary: "The new salary makes salary >= 0 false, so MySQL rejects the update.",
    appTip:
      "The Python function update_employee rejects this first. Raw SQL skips that check, so the CHECK is the backstop.",
    fix: "Use a salary of 0 or more.",
  },
  {
    id: "leave-dates",
    title: "Leave ends before it starts",
    kind: "CHECK",
    sql: "INSERT INTO leave_requests\n  (employee_id, leave_type, start_date, end_date)\nVALUES (2, 'Annual', '2026-03-10', '2026-03-05');",
    constraint: { type: "check", table: "leave_requests", name: "chk_leave_dates" },
    outcome: "rejected",
    failStep: "constraint",
    summary: "The end date is before the start date, so end_date >= start_date is false.",
    appTip: "The Python function apply_for_leave rejects this first. Raw SQL skips that check.",
    fix: "Swap the dates. A one-day leave uses the same date twice.",
  },
  {
    id: "duplicate-email",
    title: "Reusing an email",
    kind: "UNIQUE",
    sql: "INSERT INTO employees\n  (first_name, last_name, email, hire_date, salary)\nVALUES ('Dana', 'Ito', 'asha.rao@staffly.example',\n        '2026-03-02', 70000.00);",
    constraint: { type: "unique", table: "employees", name: "uq_employee_email", columns: ["email"] },
    outcome: "rejected",
    failStep: "constraint",
    dupValue: "asha.rao@staffly.example",
    summary: "Employee 1 already uses this email, so the unique index refuses a second copy.",
    appTip:
      "add_employee checks for the email first, but two users at once can both pass that check. The UNIQUE index is the real guard.",
    fix: "Use another email, or update the existing employee.",
  },
  {
    id: "duplicate-payroll",
    title: "Payroll twice in one month",
    kind: "UNIQUE",
    sql: "INSERT INTO payroll\n  (employee_id, pay_month, basic_salary, allowances, deductions)\nVALUES (2, '2026-02-01', 4000.00, 200.00, 300.00);",
    constraint: { type: "unique", table: "payroll", name: "uq_employee_pay_month", columns: ["employee_id", "pay_month"] },
    outcome: "rejected",
    failStep: "constraint",
    dupValue: "2-2026-02-01",
    summary: "Employee 2 already has payroll for 2026-02-01, so the pair is a duplicate.",
    appTip: "The Python function generate_payroll checks first. Raw SQL skips that check.",
    fix: "Update the existing payroll row instead of adding a second one.",
  },
  {
    id: "missing-department",
    title: "Unknown department",
    kind: "FOREIGN KEY",
    sql: "INSERT INTO employees\n  (first_name, last_name, email, hire_date, salary, department_id)\nVALUES ('Eli', 'Park', 'eli.park@staffly.example',\n        '2026-03-02', 60000.00, 99);",
    constraint: {
      type: "fk",
      table: "employees",
      name: "fk_employee_department",
      columns: ["department_id"],
      refTable: "departments",
    },
    outcome: "rejected",
    failStep: "constraint",
    summary: "Department 99 does not exist, so the new employee would have no parent row.",
    appTip: "add_employee does not check the department, so MySQL is the only guard here.",
    fix: "Create the department first, or use an existing department id.",
  },
  {
    id: "null-email",
    title: "Employee without an email",
    kind: "NOT NULL",
    sql: "INSERT INTO employees\n  (first_name, last_name, email, hire_date, salary)\nVALUES ('Fay', 'Kim', NULL, '2026-03-02', 55000.00);",
    constraint: { type: "notnull", table: "employees", column: "email" },
    outcome: "rejected",
    failStep: "column",
    summary: "The email column is NOT NULL, so an explicit NULL is refused.",
    appTip: "add_employee would crash on None before sending any SQL. Here the NULL is sent directly.",
    fix: "Always supply an email.",
  },
  {
    id: "write-generated",
    title: "Writing net_salary",
    kind: "GENERATED",
    sql: "INSERT INTO payroll\n  (employee_id, pay_month, basic_salary,\n   allowances, deductions, net_salary)\nVALUES (2, '2026-03-01', 4000.00, 200.00, 300.00, 9999.00);",
    constraint: { type: "generated", table: "payroll", column: "net_salary" },
    outcome: "rejected",
    failStep: "column",
    summary: "MySQL calculates net_salary itself, so only DEFAULT may be assigned to it.",
    appTip: "The Python app never sends net_salary, so only a SQL client can trigger this.",
    fix: "Leave net_salary out. MySQL fills it in.",
  },
  {
    id: "delete-department",
    title: "Deleting a department",
    kind: "SET NULL",
    sql: "DELETE FROM departments\nWHERE department_id = 10;",
    constraint: {
      type: "fk",
      table: "employees",
      name: "fk_employee_department",
      columns: ["department_id"],
      refTable: "departments",
    },
    outcome: "succeeds",
    failStep: "constraint",
    summary: "Allowed: the foreign key is ON DELETE SET NULL, so employees stay but lose their department.",
    appTip: "No Python function deletes departments, so only a SQL client can run this.",
    fix: "To block the delete, change the rule to ON DELETE RESTRICT.",
    action: { table: "departments", fk: "fk_employee_department", onDelete: "SET NULL" },
  },
];

/* ---------- Schema-backed resolution ---------- */

export interface ErrorInfo {
  errno: number;
  sqlstate: string;
  symbol: string;
  message: string;
}

export interface ResolvedScenario {
  /** False when the DDL no longer matches what the scenario claims. */
  ok: boolean;
  problems: string[];
  /** Real DDL, reconstructed from the parsed schema. */
  ddl: string;
  error: ErrorInfo | null;
}

const q = (s: string) => "`" + s + "`";

function ddlForFk(fk: ForeignKey): string {
  return (
    `CONSTRAINT ${fk.name} FOREIGN KEY (${fk.columns.join(", ")}) ` +
    `REFERENCES ${fk.refTable} (${fk.refColumns.join(", ")}) ` +
    `ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
  );
}

function fkErrorMessage(db: string, fk: ForeignKey): string {
  const clause = (kw: string, a: FkAction) => (a === "NO ACTION" || a === "RESTRICT" ? "" : ` ${kw} ${a}`);
  return (
    `Cannot add or update a child row: a foreign key constraint fails (${q(db)}.${q(fk.table)}, ` +
    `CONSTRAINT ${q(fk.name)} FOREIGN KEY (${fk.columns.map(q).join(", ")}) ` +
    `REFERENCES ${q(fk.refTable)} (${fk.refColumns.map(q).join(", ")})` +
    clause("ON DELETE", fk.onDelete) +
    clause("ON UPDATE", fk.onUpdate) +
    ")"
  );
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Validate a scenario against the parsed DDL and build DDL text and error text from it. */
export function resolveScenario(s: Scenario, schema: SchemaModel): ResolvedScenario {
  const problems: string[] = [];
  const byName = (n: string): Table | undefined => schema.tables.find((t) => t.name === n);
  let ddl = "";
  let error: ErrorInfo | null = null;

  const c = s.constraint;
  const table = byName(c.table);

  if (!table) {
    problems.push(`Table ${c.table} is not in the schema.`);
  } else {
    switch (c.type) {
      case "check": {
        const chk = table.checks.find((x) => x.name === c.name);
        if (!chk) {
          problems.push(`CHECK ${c.name} is not declared on ${c.table}.`);
        } else {
          ddl = `CONSTRAINT ${chk.name} CHECK (${chk.expression})`;
          error = {
            errno: 3819,
            sqlstate: "HY000",
            symbol: "ER_CHECK_CONSTRAINT_VIOLATED",
            message: `Check constraint '${chk.name}' is violated.`,
          };
        }
        break;
      }
      case "unique": {
        const ix = table.indexes.find((x) => x.name === c.name && x.kind === "UNIQUE");
        if (!ix) {
          problems.push(`UNIQUE index ${c.name} is not declared on ${c.table}.`);
        } else {
          if (!sameList(ix.columns, c.columns)) {
            problems.push(`${c.name} covers (${ix.columns.join(", ")}), not (${c.columns.join(", ")}).`);
          }
          ddl = `UNIQUE KEY ${ix.name} (${ix.columns.join(", ")})`;
          error = {
            errno: 1062,
            sqlstate: "23000",
            symbol: "ER_DUP_ENTRY",
            message: `Duplicate entry '${s.dupValue ?? "?"}' for key '${table.name}.${ix.name}'`,
          };
        }
        break;
      }
      case "fk": {
        const fk = table.foreignKeys.find((f) => f.name === c.name);
        if (!fk) {
          problems.push(`Foreign key ${c.name} is not declared on ${c.table}.`);
          break;
        }
        if (!sameList(fk.columns, c.columns)) {
          problems.push(`${c.name} covers (${fk.columns.join(", ")}), not (${c.columns.join(", ")}).`);
        }
        if (fk.refTable !== c.refTable) problems.push(`${c.name} references ${fk.refTable}, not ${c.refTable}.`);
        ddl = ddlForFk(fk);
        if (s.outcome === "rejected") {
          error = {
            errno: 1452,
            sqlstate: "23000",
            symbol: "ER_NO_REFERENCED_ROW_2",
            message: fkErrorMessage(schema.database, fk),
          };
        }
        break;
      }
      case "notnull": {
        const col = table.columns.find((x) => x.name === c.column);
        if (!col) problems.push(`Column ${c.table}.${c.column} does not exist.`);
        else if (col.nullable) problems.push(`Column ${c.table}.${c.column} is nullable in the DDL.`);
        else {
          ddl = `${col.name} ${col.type} NOT NULL`;
          error = {
            errno: 1048,
            sqlstate: "23000",
            symbol: "ER_BAD_NULL_ERROR",
            message: `Column '${col.name}' cannot be null`,
          };
        }
        break;
      }
      case "generated": {
        const col = table.columns.find((x) => x.name === c.column);
        if (!col) problems.push(`Column ${c.table}.${c.column} does not exist.`);
        else if (!col.generatedExpr) problems.push(`Column ${c.table}.${c.column} is not a generated column in the DDL.`);
        else {
          ddl = `${col.name} ${col.type} GENERATED ALWAYS AS (${col.generatedExpr})`;
          error = {
            errno: 3105,
            sqlstate: "HY000",
            symbol: "ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN",
            message: `The value specified for generated column '${col.name}' in table '${c.table}' is not allowed.`,
          };
        }
        break;
      }
    }
  }

  // Referential action: the firing FK must point at the target table with the claimed rule.
  if (s.action) {
    const fired = byName(s.action.table)?.referencedBy.find((f) => f.name === s.action!.fk);
    if (!fired) problems.push(`${s.action.fk} does not reference ${s.action.table}.`);
    else if (fired.onDelete !== s.action.onDelete) {
      problems.push(`${fired.name} is ON DELETE ${fired.onDelete} in the DDL, not ${s.action.onDelete}.`);
    }
  }

  return { ok: problems.length === 0, problems, ddl, error };
}

/** Resolve every scenario once. */
export function resolveAll(schema: SchemaModel): Record<string, ResolvedScenario> {
  return Object.fromEntries(SCENARIOS.map((s) => [s.id, resolveScenario(s, schema)]));
}
