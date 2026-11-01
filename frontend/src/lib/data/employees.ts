/**
 * Employees data layer (server only). Mirrors the employee functions in
 * backend/employee_backend.py: view_employees, search_employee,
 * view_employees_by_status, add_employee, update_employee,
 * update_own_contact, deactivate_employee, reactivate_employee and the
 * dropdown helpers. All SQL is parameterised; the only values ever
 * interpolated into SQL text are integers that were validated first
 * (LIMIT/OFFSET) and column names taken from a fixed whitelist.
 *
 * Authentication is currently disabled app-wide (see src/lib/session.ts), so
 * everyone sees and may change everything; there is no per-role branching here.
 */
import type { ExecuteValues } from 'mysql2';
import type { ResultSetHeader } from 'mysql2/promise';
import pool, { executeQuery, recordQuery, type QueryOperation } from '@/lib/db';
import {
  EMPLOYMENT_STATUSES,
  type EmployeeField,
  type EmployeeInput,
  type EmploymentStatus,
  type FieldErrors,
} from '@/lib/validation/employee';

export const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ types */

export interface EmployeeListRow {
  employee_id: number;
  first_name: string;
  last_name: string;
  email: string;
  hire_date: string;
  department_id: number | null;
  department_name: string | null;
  role_title: string | null;
  manager_id: number | null;
  manager_name: string | null;
  employment_status: EmploymentStatus;
}

export interface EmployeeDetail {
  employee_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  hire_date: string;
  created_at: string | null;
  salary: number;
  department_id: number | null;
  department_name: string | null;
  department_location: string | null;
  role_id: number | null;
  role_title: string | null;
  role_min_salary: number | null;
  role_max_salary: number | null;
  manager_id: number | null;
  manager_name: string | null;
  manager_status: EmploymentStatus | null;
  employment_status: EmploymentStatus;
  attendance_count: number;
  leave_count: number;
  payroll_count: number;
  report_count: number;
}

export interface ListFilters {
  search: string;
  status: EmploymentStatus | null;
  departmentId: number | null;
  page: number;
}

export interface EmployeeListResult {
  rows: EmployeeListRow[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Partial<Record<EmploymentStatus, number>>;
}

export interface Option {
  value: number;
  label: string;
}

export type MutationResult =
  | { ok: true; id: number; message: string }
  | { ok: false; message: string; errors?: FieldErrors };

/* --------------------------------------------------------------- helpers */

export function toIsoDate(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'string') return v.slice(0, 10);
  return '';
}

function isStatus(v: unknown): v is EmploymentStatus {
  return typeof v === 'string' && (EMPLOYMENT_STATUSES as readonly string[]).includes(v);
}

export function parseStatus(v: string | undefined): EmploymentStatus | null {
  return v && isStatus(v) ? v : null;
}

/** Connection-level failures, as opposed to SQL errors raised by a statement. */
export function isConnectionError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number } | null;
  const code = e?.code ?? '';
  return (
    [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'PROTOCOL_CONNECTION_LOST',
      'ER_ACCESS_DENIED_ERROR',
      'ER_BAD_DB_ERROR',
      'ER_NO_SUCH_TABLE',
    ].includes(code) || e?.errno === 1045 || e?.errno === 1049 || e?.errno === 1146
  );
}

/** Thrown inside a transaction to roll it back with a friendly message. */
class RuleError extends Error {
  constructor(
    message: string,
    public errors?: FieldErrors
  ) {
    super(message);
  }
}

/** Translate MySQL errors into calm, field-aware messages (errno as in the backend). */
export function mapDbError(err: unknown): { message: string; errors?: FieldErrors } {
  if (err instanceof RuleError) return { message: err.message, errors: err.errors };
  if (isConnectionError(err)) {
    return { message: 'The database is not reachable right now. Nothing was saved; please try again shortly.' };
  }
  const e = err as { errno?: number; sqlMessage?: string; message?: string } | null;
  const text = `${e?.sqlMessage ?? ''} ${e?.message ?? ''}`;
  switch (e?.errno) {
    case 1062: {
      const msg = 'That email address is already in use by another employee.';
      return { message: msg, errors: { email: msg } };
    }
    case 3819: {
      if (text.includes('chk_employee_salary')) {
        const msg = 'The database rejected this salary: it must be zero or more.';
        return { message: msg, errors: { salary: msg } };
      }
      if (text.includes('chk_employment_status')) {
        const msg = 'Employment status must be Active, Inactive or On Leave.';
        return { message: msg, errors: { employment_status: msg } };
      }
      return { message: 'The database rejected these values because a rule (CHECK constraint) was not met.' };
    }
    case 1452: {
      const field: Record<string, EmployeeField> = {
        fk_employee_department: 'department_id',
        fk_employee_role: 'role_id',
        fk_employee_manager: 'manager_id',
      };
      const hit = Object.keys(field).find((k) => text.includes(k));
      const msg = 'That department, job role or manager no longer exists. Pick another and try again.';
      return { message: msg, errors: hit ? { [field[hit]]: msg } : undefined };
    }
    case 1264:
    case 1406:
    case 1366:
      return { message: 'One of the values does not fit its column (too long or out of range).' };
    default:
      return { message: 'Something went wrong while saving. Nothing was changed.' };
  }
}

/* ----------------------------------------------------------- transactions */

interface Tx {
  query<R>(sql: string, params: ExecuteValues[], concept: string): Promise<R>;
}

function opOf(sql: string): QueryOperation {
  const s = sql.trim().toUpperCase();
  if (s.startsWith('SELECT')) return 'SELECT';
  if (s.startsWith('INSERT')) return 'INSERT';
  if (s.startsWith('UPDATE')) return 'UPDATE';
  if (s.startsWith('DELETE')) return 'DELETE';
  return 'TRANSACTION';
}

/**
 * Run `fn` on one pooled connection inside START TRANSACTION ... COMMIT,
 * rolling back on any error. Every statement is recorded in the shared query
 * log so the "Under the hood" trace shows the transaction boundaries too.
 */
async function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  const mark = async (label: string, run: () => Promise<unknown>, concept: string) => {
    const t0 = performance.now();
    try {
      await run();
      recordQuery({
        sql: label, params: [], durationMs: Math.round((performance.now() - t0) * 100) / 100,
        rowCount: 0, operation: 'TRANSACTION', concept,
      });
    } catch (error) {
      recordQuery({
        sql: label, params: [], durationMs: Math.round((performance.now() - t0) * 100) / 100,
        rowCount: 0, operation: 'TRANSACTION', concept, error,
      });
      throw error;
    }
  };

  try {
    await mark('START TRANSACTION', () => conn.beginTransaction(), 'Atomicity: all statements succeed together or not at all');
    const tx: Tx = {
      async query<R>(sql: string, params: ExecuteValues[], concept: string) {
        const t0 = performance.now();
        const ms = () => Math.round((performance.now() - t0) * 100) / 100;
        try {
          const [result] = await conn.execute(sql, params);
          const rowCount = Array.isArray(result)
            ? result.length
            : typeof (result as ResultSetHeader).affectedRows === 'number'
              ? (result as ResultSetHeader).affectedRows
              : 0;
          recordQuery({ sql, params, durationMs: ms(), rowCount, operation: opOf(sql), concept });
          return result as R;
        } catch (error) {
          recordQuery({ sql, params, durationMs: ms(), rowCount: 0, operation: opOf(sql), concept, error });
          throw error;
        }
      },
    };
    const out = await fn(tx);
    await mark('COMMIT', () => conn.commit(), 'Durability: the change becomes permanent');
    return out;
  } catch (error) {
    try {
      await mark('ROLLBACK', () => conn.rollback(), 'Atomicity: undo every statement of this transaction');
    } catch {
      /* the connection is gone; nothing left to undo */
    }
    throw error;
  } finally {
    conn.release();
  }
}

/* ------------------------------------------------------------------ reads */

const LIST_SELECT = `
  SELECT
    e.employee_id, e.first_name, e.last_name, e.email, e.hire_date,
    e.department_id, d.department_name,
    j.role_title,
    e.manager_id, CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
    e.employment_status
  FROM employees e
  LEFT JOIN departments d ON e.department_id = d.department_id
  LEFT JOIN job_roles j ON e.role_id = j.role_id
  LEFT JOIN employees m ON e.manager_id = m.employee_id`;

/** view_employees / search_employee / view_employees_by_status in one query. */
export async function listEmployees(filters: ListFilters): Promise<EmployeeListResult> {
  const where: string[] = [];
  const params: ExecuteValues[] = [];

  if (filters.status) {
    where.push('e.employment_status = ?');
    params.push(filters.status);
  }
  if (filters.departmentId !== null) {
    where.push('e.department_id = ?');
    params.push(filters.departmentId);
  }

  // search_employee semantics: digits -> id, '@' -> email, otherwise name.
  const q = filters.search.trim();
  if (q) {
    if (/^\d+$/.test(q)) {
      where.push('e.employee_id = ?');
      params.push(Number(q));
    } else if (q.includes('@')) {
      where.push('LOWER(e.email) = LOWER(?)');
      params.push(q);
    } else {
      const pattern = `%${q}%`;
      where.push("(CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)");
      params.push(pattern, pattern, pattern);
    }
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  // The count needs no joins: the LEFT JOINs match on unique keys, so they never change the row count.
  const countRes = await executeQuery<{ total: number }[]>(
    `SELECT COUNT(*) AS total FROM employees e${whereSql}`,
    params,
    'Aggregate COUNT for pagination'
  );
  const total = Number(countRes.rows[0]?.total ?? 0);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(filters.page) || 1), pages);
  const offset = (page - 1) * PAGE_SIZE;
  // Integers only (validated above): LIMIT/OFFSET cannot be bound as prepared parameters by the driver.
  if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid page');

  const listRes = await executeQuery<Record<string, unknown>[]>(
    `${LIST_SELECT}${whereSql} ORDER BY e.employee_id LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    params,
    'Three LEFT JOINs: department, job role, manager (self-join)'
  );

  const rows: EmployeeListRow[] = listRes.rows.map((r) => ({
    employee_id: Number(r.employee_id),
    first_name: String(r.first_name),
    last_name: String(r.last_name),
    email: String(r.email),
    hire_date: toIsoDate(r.hire_date),
    department_id: r.department_id === null ? null : Number(r.department_id),
    department_name: (r.department_name as string | null) ?? null,
    role_title: (r.role_title as string | null) ?? null,
    manager_id: r.manager_id === null ? null : Number(r.manager_id),
    manager_name: (r.manager_name as string | null) ?? null,
    employment_status: isStatus(r.employment_status) ? r.employment_status : 'Active',
  }));

  const statusCounts: EmployeeListResult['statusCounts'] = {};
  const counts = await executeQuery<{ employment_status: string; n: number }[]>(
    'SELECT employment_status, COUNT(*) AS n FROM employees GROUP BY employment_status',
    [],
    'Aggregate Functions & Grouping'
  );
  for (const c of counts.rows) if (isStatus(c.employment_status)) statusCounts[c.employment_status] = Number(c.n);

  return { rows, total, page, pageSize: PAGE_SIZE, statusCounts };
}

/** One employee with the same joins plus COUNT subqueries over child tables. */
export async function getEmployeeDetail(id: number): Promise<EmployeeDetail | null> {
  const res = await executeQuery<Record<string, unknown>[]>(
    `SELECT
       e.employee_id, e.first_name, e.last_name, e.email, e.phone, e.hire_date, e.created_at, e.salary,
       e.department_id, d.department_name, d.location AS department_location,
       e.role_id, j.role_title, j.min_salary AS role_min_salary, j.max_salary AS role_max_salary,
       e.manager_id, CONCAT(m.first_name, ' ', m.last_name) AS manager_name, m.employment_status AS manager_status,
       e.employment_status,
       (SELECT COUNT(*) FROM attendance a WHERE a.employee_id = e.employee_id) AS attendance_count,
       (SELECT COUNT(*) FROM leave_requests l WHERE l.employee_id = e.employee_id) AS leave_count,
       (SELECT COUNT(*) FROM payroll p WHERE p.employee_id = e.employee_id) AS payroll_count,
       (SELECT COUNT(*) FROM employees r WHERE r.manager_id = e.employee_id) AS report_count
     FROM employees e
     LEFT JOIN departments d ON e.department_id = d.department_id
     LEFT JOIN job_roles j ON e.role_id = j.role_id
     LEFT JOIN employees m ON e.manager_id = m.employee_id
     WHERE e.employee_id = ?`,
    [id],
    'Joins + correlated COUNT subqueries for linked records'
  );
  const r = res.rows[0];
  if (!r) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    employee_id: Number(r.employee_id),
    first_name: String(r.first_name),
    last_name: String(r.last_name),
    email: String(r.email),
    phone: (r.phone as string | null) ?? null,
    hire_date: toIsoDate(r.hire_date),
    created_at: r.created_at ? toIsoDate(r.created_at) : null,
    salary: Number(r.salary),
    department_id: num(r.department_id),
    department_name: (r.department_name as string | null) ?? null,
    department_location: (r.department_location as string | null) ?? null,
    role_id: num(r.role_id),
    role_title: (r.role_title as string | null) ?? null,
    role_min_salary: num(r.role_min_salary),
    role_max_salary: num(r.role_max_salary),
    manager_id: num(r.manager_id),
    manager_name: (r.manager_name as string | null) ?? null,
    manager_status: isStatus(r.manager_status) ? r.manager_status : null,
    employment_status: isStatus(r.employment_status) ? r.employment_status : 'Active',
    attendance_count: Number(r.attendance_count),
    leave_count: Number(r.leave_count),
    payroll_count: Number(r.payroll_count),
    report_count: Number(r.report_count),
  };
}

/** get_departments */
export async function listDepartmentOptions(): Promise<Option[]> {
  const res = await executeQuery<{ department_id: number; department_name: string }[]>(
    'SELECT department_id, department_name FROM departments ORDER BY department_name'
  );
  return res.rows.map((r) => ({ value: Number(r.department_id), label: r.department_name }));
}

/** get_job_roles */
export async function listRoleOptions(): Promise<Option[]> {
  const res = await executeQuery<{ role_id: number; role_title: string }[]>(
    'SELECT role_id, role_title FROM job_roles ORDER BY role_title'
  );
  return res.rows.map((r) => ({ value: Number(r.role_id), label: r.role_title }));
}

/**
 * get_active_employees_for_dropdown. On the edit form, `keepId` keeps the
 * current manager selectable even if they are no longer active, and
 * `excludeId` removes the employee being edited (nobody manages themself).
 */
export async function listManagerOptions(opts: { keepId?: number | null; excludeId?: number } = {}): Promise<Option[]> {
  const params: ExecuteValues[] = [];
  let sql = "SELECT employee_id, CONCAT(first_name, ' ', last_name) AS employee_name FROM employees WHERE (employment_status = 'Active'";
  if (opts.keepId) {
    sql += ' OR employee_id = ?';
    params.push(opts.keepId);
  }
  sql += ')';
  if (opts.excludeId) {
    sql += ' AND employee_id <> ?';
    params.push(opts.excludeId);
  }
  sql += ' ORDER BY first_name, last_name';
  const res = await executeQuery<{ employee_id: number; employee_name: string }[]>(sql, params);
  return res.rows.map((r) => ({ value: Number(r.employee_id), label: `${r.employee_name} (#${r.employee_id})` }));
}

/* ----------------------------------------------------------------- writes */

async function guard(run: () => Promise<MutationResult>): Promise<MutationResult> {
  try {
    return await run();
  } catch (err) {
    const mapped = mapDbError(err);
    return { ok: false, message: mapped.message, errors: mapped.errors };
  }
}

/** add_employee: duplicate-email pre-check, INSERT, commit; 1062 still handled for races. */
export async function createEmployee(input: EmployeeInput): Promise<MutationResult> {
  return guard(() =>
    inTransaction(async (tx) => {
      const dup = await tx.query<{ employee_id: number }[]>(
        'SELECT employee_id FROM employees WHERE email = ?',
        [input.email],
        'Uniqueness pre-check (the UNIQUE index also enforces it)'
      );
      if (dup.length > 0) {
        const msg = 'An employee with this email already exists.';
        throw new RuleError(msg, { email: msg });
      }
      const ins = await tx.query<ResultSetHeader>(
        `INSERT INTO employees
           (first_name, last_name, email, phone, hire_date, salary, department_id, role_id, manager_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.first_name, input.last_name, input.email, input.phone, input.hire_date,
          input.salary, input.department_id, input.role_id, input.manager_id,
        ],
        'Relational Tuple Insertion with Primary Key Auto-Increment'
      );
      return { ok: true as const, id: ins.insertId, message: `Employee added. New employee ID: ${ins.insertId}.` };
    })
  );
}

const EDITABLE_COLUMNS = [
  'first_name', 'last_name', 'email', 'phone', 'hire_date', 'salary',
  'department_id', 'role_id', 'manager_id', 'employment_status',
] as const;

/** update_employee (Admin/HR): builds SET only from changed, whitelisted columns. */
export async function updateEmployee(id: number, input: EmployeeInput): Promise<MutationResult> {
  return guard(() =>
    inTransaction(async (tx) => {
      const cur = await tx.query<Record<string, unknown>[]>(
        `SELECT first_name, last_name, email, phone, hire_date, salary,
                department_id, role_id, manager_id, employment_status
         FROM employees WHERE employee_id = ?`,
        [id],
        'Indexed Primary Key Point Lookup'
      );
      if (cur.length === 0) throw new RuleError('Employee not found.');
      const row = cur[0];

      const next: Record<(typeof EDITABLE_COLUMNS)[number], ExecuteValues> = {
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone,
        hire_date: input.hire_date,
        salary: input.salary,
        department_id: input.department_id,
        role_id: input.role_id,
        manager_id: input.manager_id,
        employment_status: input.employment_status,
      };
      const same = (col: (typeof EDITABLE_COLUMNS)[number]) => {
        const before = row[col];
        const after = next[col];
        if (col === 'hire_date') return toIsoDate(before) === after;
        if (col === 'salary') return Number(before) === Number(after);
        return (before ?? null) === (after ?? null);
      };
      const changed = EDITABLE_COLUMNS.filter((c) => !same(c));
      if (changed.length === 0) throw new RuleError('No changes were provided.');

      const setClause = changed.map((c) => `${c} = ?`).join(', ');
      await tx.query<ResultSetHeader>(
        `UPDATE employees SET ${setClause} WHERE employee_id = ?`,
        [...changed.map((c) => next[c]), id],
        'Atomic In-Place State Mutation'
      );
      return { ok: true as const, id, message: `Employee updated (${changed.join(', ').replace(/_/g, ' ')}).` };
    })
  );
}

/** deactivate_employee / reactivate_employee. History is preserved either way. */
export async function setEmployeeActive(id: number, makeActive: boolean): Promise<MutationResult> {
  return guard(() =>
    inTransaction(async (tx) => {
      const cur = await tx.query<{ employment_status: string }[]>(
        'SELECT employment_status FROM employees WHERE employee_id = ?',
        [id],
        'Indexed Primary Key Point Lookup'
      );
      if (cur.length === 0) throw new RuleError('Employee not found.');
      const status = cur[0].employment_status;

      if (makeActive) {
        if (status !== 'Inactive') throw new RuleError('This employee is not inactive.');
        await tx.query<ResultSetHeader>(
          "UPDATE employees SET employment_status = 'Active' WHERE employee_id = ?",
          [id],
          'Atomic In-Place State Mutation'
        );
        return { ok: true as const, id, message: 'Employee reactivated.' };
      }
      if (status === 'Inactive') throw new RuleError('This employee is already inactive.');
      await tx.query<ResultSetHeader>(
        "UPDATE employees SET employment_status = 'Inactive' WHERE employee_id = ?",
        [id],
        'Soft delete: the row and its history are kept'
      );
      return { ok: true as const, id, message: "Employee deactivated. Their historical records have been preserved." };
    })
  );
}
