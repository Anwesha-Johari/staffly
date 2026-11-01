/**
 * Payroll data access. Mirrors backend/employee_backend.py
 * (generate_payroll, view_payroll, update_payroll_status).
 *
 * Every statement is parameterised and goes through executeQuery so it shows
 * up in the SQL trace. These functions never throw: database failures come
 * back as `{ ok: false }` so that captureSql() still returns the statements
 * that ran before the failure.
 *
 * Written against database/schemas.sql; not exercised against a live MySQL.
 */
import { executeQuery } from '@/lib/db';
import {
  centsToDecimalString,
  type GeneratePayrollInput,
  type PaymentStatus,
} from '@/lib/validation/payroll';

/* ------------------------------------------------------------ result types */

export type DbFailureKind = 'unavailable' | 'duplicate' | 'check' | 'other';

export type DataResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: DbFailureKind; message: string; field?: string };

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_NO_SUCH_TABLE',
  'ER_DBACCESS_DENIED_ERROR',
]);

interface MysqlErrorLike {
  code?: string;
  errno?: number;
  sqlMessage?: string;
  message?: string;
}

/** Classify a thrown mysql2 error (also used by the accounts data layer). */
export function classifyDbError(error: unknown): {
  kind: DbFailureKind;
  errno?: number;
  detail: string;
} {
  const e = (error ?? {}) as MysqlErrorLike;
  const detail = e.sqlMessage ?? e.message ?? 'Database error';
  if (e.errno === 1062 || e.code === 'ER_DUP_ENTRY') return { kind: 'duplicate', errno: 1062, detail };
  if (e.errno === 3819 || e.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return { kind: 'check', errno: 3819, detail };
  }
  if (e.code && CONNECTION_CODES.has(e.code)) return { kind: 'unavailable', errno: e.errno, detail };
  return { kind: 'other', errno: e.errno, detail };
}

function fail(error: unknown): { ok: false; kind: DbFailureKind; message: string } {
  const info = classifyDbError(error);
  if (info.kind === 'unavailable') {
    return { ok: false, kind: 'unavailable', message: 'The database is not reachable right now.' };
  }
  return { ok: false, kind: info.kind, message: 'The database could not complete that request.' };
}

/* --------------------------------------------------------------- read side */

export interface PayslipRow {
  payrollId: number;
  employeeId: number;
  employeeName: string;
  /** YYYY-MM-DD, always the first of the month. */
  payMonth: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  /** Computed by MySQL (GENERATED ALWAYS AS ... STORED). Never written by the app. */
  netSalary: number;
  paymentStatus: PaymentStatus;
  /** YYYY-MM-DD or null. */
  paymentDate: string | null;
}

export interface PayrollTotals {
  count: number;
  basic: number;
  allowances: number;
  deductions: number;
  net: number;
}

export interface PayrollQuery {
  /** Optionally restrict to one employee; null lists everyone. */
  employeeId: number | null;
  /** YYYY-MM-01, or null for every month. */
  payMonth: string | null;
  limit: number;
  offset: number;
}

function filters(q: Pick<PayrollQuery, 'employeeId' | 'payMonth'>): {
  where: string;
  params: Array<number | string>;
} {
  let where = ' WHERE 1 = 1';
  const params: Array<number | string> = [];
  if (q.employeeId !== null) {
    where += ' AND p.employee_id = ?';
    params.push(q.employeeId);
  }
  if (q.payMonth !== null) {
    where += ' AND p.pay_month = ?';
    params.push(q.payMonth);
  }
  return { where, params };
}

/** LIMIT/OFFSET are interpolated (prepared statements reject them as `?`), so clamp to plain integers. */
function safeInt(value: number, min: number, max: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

const PAYSLIP_COLUMNS = `
  p.payroll_id AS payrollId,
  p.employee_id AS employeeId,
  CONCAT(e.first_name, ' ', e.last_name) AS employeeName,
  DATE_FORMAT(p.pay_month, '%Y-%m-%d') AS payMonth,
  p.basic_salary AS basicSalary,
  p.allowances AS allowances,
  p.deductions AS deductions,
  p.net_salary AS netSalary,
  p.payment_status AS paymentStatus,
  DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS paymentDate`;

/** view_payroll: payslips joined to employees, newest month first. */
export async function listPayslips(q: PayrollQuery): Promise<DataResult<PayslipRow[]>> {
  const { where, params } = filters(q);
  try {
    const { rows } = await executeQuery<PayslipRow[]>(
      `SELECT ${PAYSLIP_COLUMNS}
       FROM payroll p
       JOIN employees e ON p.employee_id = e.employee_id${where}
       ORDER BY p.pay_month DESC, p.employee_id
       LIMIT ${safeInt(q.limit, 1, 500)} OFFSET ${safeInt(q.offset, 0, 1_000_000)}`,
      params,
      'Relational JOIN: payroll.employee_id resolves to the employee name',
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

/** Column totals for the same filter, computed by MySQL. */
export async function payrollTotals(
  q: Pick<PayrollQuery, 'employeeId' | 'payMonth'>,
): Promise<DataResult<PayrollTotals>> {
  const { where, params } = filters(q);
  try {
    const { rows } = await executeQuery<PayrollTotals[]>(
      `SELECT
         COUNT(*) AS count,
         COALESCE(SUM(p.basic_salary), 0) AS basic,
         COALESCE(SUM(p.allowances), 0) AS allowances,
         COALESCE(SUM(p.deductions), 0) AS deductions,
         COALESCE(SUM(p.net_salary), 0) AS net
       FROM payroll p${where}`,
      params,
      'Aggregate Functions: SUM over the generated net_salary column',
    );
    const r = rows[0];
    return {
      ok: true,
      data: {
        count: Number(r?.count ?? 0),
        basic: Number(r?.basic ?? 0),
        allowances: Number(r?.allowances ?? 0),
        deductions: Number(r?.deductions ?? 0),
        net: Number(r?.net ?? 0),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export interface PayslipDetail extends PayslipRow {
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  createdAt: string | null;
}

/** One payslip with employee context. */
export async function getPayslip(
  payrollId: number,
): Promise<DataResult<PayslipDetail | null>> {
  try {
    const { rows } = await executeQuery<PayslipDetail[]>(
      `SELECT ${PAYSLIP_COLUMNS},
         e.email AS email,
         d.department_name AS department,
         r.role_title AS jobTitle,
         DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS createdAt
       FROM payroll p
       JOIN employees e ON p.employee_id = e.employee_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN job_roles r ON e.role_id = r.role_id
       WHERE p.payroll_id = ?`,
      [payrollId],
      'Indexed Primary Key Point Lookup with LEFT JOINs',
    );
    return { ok: true, data: rows[0] ?? null };
  } catch (error) {
    return fail(error);
  }
}

export interface PayrollEmployeeOption {
  employeeId: number;
  name: string;
  salary: number;
  status: string;
}

/** Employees that payroll can be generated for (generate_payroll only requires that the employee exists). */
export async function listEmployeeOptions(): Promise<DataResult<PayrollEmployeeOption[]>> {
  try {
    const { rows } = await executeQuery<PayrollEmployeeOption[]>(
      `SELECT employee_id AS employeeId,
              CONCAT(first_name, ' ', last_name) AS name,
              salary AS salary,
              employment_status AS status
       FROM employees
       ORDER BY first_name, last_name`,
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- write side */

export interface GeneratedPayslip {
  payrollId: number;
  /** Read back from MySQL after the insert, as a decimal string. */
  netSalary: string;
}

/**
 * generate_payroll. Validation has already happened; this checks that the
 * employee exists, guards against a duplicate (employee, month), then inserts
 * only the five editable columns. net_salary is never named in the INSERT.
 */
export async function generatePayroll(
  input: GeneratePayrollInput,
): Promise<DataResult<GeneratedPayslip>> {
  try {
    const employee = await executeQuery<Array<{ employee_id: number }>>(
      'SELECT employee_id FROM employees WHERE employee_id = ?',
      [input.employeeId],
    );
    if (employee.rows.length === 0) {
      return { ok: false, kind: 'other', field: 'employeeId', message: 'Employee not found.' };
    }

    const existing = await executeQuery<Array<{ payroll_id: number }>>(
      'SELECT payroll_id FROM payroll WHERE employee_id = ? AND pay_month = ?',
      [input.employeeId, input.payMonth],
    );
    if (existing.rows.length > 0) {
      return {
        ok: false,
        kind: 'duplicate',
        field: 'employeeId',
        message: 'Payroll already exists for this employee and month.',
      };
    }

    const inserted = await executeQuery<{ insertId: number }>(
      `INSERT INTO payroll (employee_id, pay_month, basic_salary, allowances, deductions)
       VALUES (?, ?, ?, ?, ?)`,
      [input.employeeId, input.payMonth, input.basicSalary, input.allowances, input.deductions],
      'Unique Key & Constraint Enforcement: uq_employee_pay_month, chk_payroll_amounts, generated net_salary',
    );
    const payrollId = inserted.rows.insertId;

    // Read back what MySQL computed, instead of trusting our own arithmetic.
    let netSalary = centsToDecimalString(input.netCents);
    try {
      const net = await executeQuery<Array<{ net_salary: number | string }>>(
        'SELECT net_salary FROM payroll WHERE payroll_id = ?',
        [payrollId],
      );
      if (net.rows[0]) netSalary = Number(net.rows[0].net_salary).toFixed(2);
    } catch {
      // The row is committed; the read-back is only for display.
    }
    return { ok: true, data: { payrollId, netSalary } };
  } catch (error) {
    const info = classifyDbError(error);
    if (info.kind === 'duplicate') {
      return {
        ok: false,
        kind: 'duplicate',
        field: 'employeeId',
        message: 'Payroll already exists for this employee and month (UNIQUE employee_id + pay_month).',
      };
    }
    if (info.kind === 'check') {
      return {
        ok: false,
        kind: 'check',
        field: 'deductions',
        message:
          'MySQL rejected these amounts (chk_payroll_amounts): amounts must be non-negative and deductions cannot exceed basic salary plus allowances.',
      };
    }
    return fail(error);
  }
}

/**
 * update_payroll_status. Paid records today's date (CURRENT_DATE evaluated by
 * MySQL); Pending and On Hold clear payment_date.
 */
export async function updatePaymentStatus(
  payrollId: number,
  status: PaymentStatus,
): Promise<DataResult<{ payrollId: number; status: PaymentStatus }>> {
  try {
    const found = await executeQuery<Array<{ payroll_id: number }>>(
      'SELECT payroll_id FROM payroll WHERE payroll_id = ?',
      [payrollId],
    );
    if (found.rows.length === 0) {
      return { ok: false, kind: 'other', message: 'Payroll record not found.' };
    }

    if (status === 'Paid') {
      await executeQuery(
        `UPDATE payroll
         SET payment_status = ?, payment_date = CURRENT_DATE
         WHERE payroll_id = ?`,
        [status, payrollId],
        'Atomic In-Place State Mutation: payment_date is set by MySQL',
      );
    } else {
      await executeQuery(
        `UPDATE payroll
         SET payment_status = ?, payment_date = NULL
         WHERE payroll_id = ?`,
        [status, payrollId],
        'Atomic In-Place State Mutation: payment_date cleared',
      );
    }
    return { ok: true, data: { payrollId, status } };
  } catch (error) {
    const info = classifyDbError(error);
    if (info.kind === 'check') {
      return {
        ok: false,
        kind: 'check',
        message: 'MySQL rejected that status (chk_payment_status allows Pending, Paid, On Hold).',
      };
    }
    return fail(error);
  }
}
