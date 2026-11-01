/**
 * Attendance data access. Mirrors backend/employee_backend.py
 * (mark_attendance, view_attendance, monthly_attendance_summary).
 *
 * Every statement is parameterised and goes through executeQuery so it shows
 * up in the SQL trace. These functions never throw: database failures come
 * back as `{ ok: false }` so that captureSql() still returns the statements
 * that ran before the failure.
 *
 * Written against database/schemas.sql; not exercised against a live MySQL.
 */
import { executeQuery } from '@/lib/db';
import type { AttendanceStatus, MarkAttendanceInput, MonthRange } from '@/lib/validation/attendance';

export type DbFailureKind = 'unavailable' | 'duplicate' | 'check' | 'reference' | 'other';

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
  message?: string;
}

function classify(error: unknown): DbFailureKind {
  const e = (error ?? {}) as MysqlErrorLike;
  if (e.errno === 1062 || e.code === 'ER_DUP_ENTRY') return 'duplicate';
  if (e.errno === 3819 || e.code === 'ER_CHECK_CONSTRAINT_VIOLATED') return 'check';
  if (e.errno === 1452 || e.code === 'ER_NO_REFERENCED_ROW_2') return 'reference';
  if (e.code && CONNECTION_CODES.has(e.code)) return 'unavailable';
  return 'other';
}

function fail(error: unknown): { ok: false; kind: DbFailureKind; message: string } {
  const kind = classify(error);
  if (kind === 'unavailable') {
    return { ok: false, kind, message: 'The database is not reachable right now.' };
  }
  return { ok: false, kind, message: 'The database could not complete that request.' };
}

/* ------------------------------------------------------------------ reads */

export interface EmployeeOption {
  employeeId: number;
  name: string;
  status: string;
}

/**
 * Employees for the pickers. `activeOnly` mirrors get_active_employees_for_dropdown
 * (used when marking attendance); viewing history also lists inactive staff.
 */
export async function listEmployeeOptions(activeOnly: boolean): Promise<DataResult<EmployeeOption[]>> {
  try {
    const { rows } = await executeQuery<EmployeeOption[]>(
      `SELECT employee_id AS employeeId,
              CONCAT(first_name, ' ', last_name) AS name,
              employment_status AS status
       FROM employees${activeOnly ? " WHERE employment_status = 'Active'" : ''}
       ORDER BY first_name, last_name`,
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

export interface EmployeeName {
  employeeId: number;
  name: string;
}

/** monthly_attendance_summary starts by confirming the employee exists. */
export async function getEmployeeName(employeeId: number): Promise<DataResult<EmployeeName | null>> {
  try {
    const { rows } = await executeQuery<EmployeeName[]>(
      `SELECT employee_id AS employeeId, CONCAT(first_name, ' ', last_name) AS name
       FROM employees
       WHERE employee_id = ?`,
      [employeeId],
      'Indexed Primary Key Point Lookup',
    );
    return { ok: true, data: rows[0] ?? null };
  } catch (error) {
    return fail(error);
  }
}

export interface AttendanceDay {
  attendanceId: number;
  /** YYYY-MM-DD. */
  date: string;
  /** HH:MM:SS or null. */
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
}

/**
 * view_attendance for one employee and one month. The half-open range
 * [start, next) lets MySQL walk the (employee_id, attendance_date) unique
 * index instead of applying a function to every row.
 */
export async function listEmployeeMonth(
  employeeId: number,
  month: MonthRange,
): Promise<DataResult<AttendanceDay[]>> {
  try {
    const { rows } = await executeQuery<AttendanceDay[]>(
      `SELECT attendance_id AS attendanceId,
              DATE_FORMAT(attendance_date, '%Y-%m-%d') AS date,
              check_in AS checkIn,
              check_out AS checkOut,
              attendance_status AS status
       FROM attendance
       WHERE employee_id = ?
         AND attendance_date >= ?
         AND attendance_date < ?
       ORDER BY attendance_date`,
      [employeeId, month.start, month.next],
      'Range Scan on the unique index uq_employee_attendance (employee_id, attendance_date)',
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

export interface MonthlySummary {
  totalDaysRecorded: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  holidays: number;
}

interface SummaryRow {
  total: number | string;
  present: number | string | null;
  absent: number | string | null;
  half: number | string | null;
  holidays: number | string | null;
}

/** monthly_attendance_summary: one aggregate row over the same half-open range. */
export async function monthlySummary(
  employeeId: number,
  month: MonthRange,
): Promise<DataResult<MonthlySummary>> {
  try {
    const { rows } = await executeQuery<SummaryRow[]>(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(attendance_status = 'Present'), 0) AS present,
         COALESCE(SUM(attendance_status = 'Absent'), 0) AS absent,
         COALESCE(SUM(attendance_status = 'Half Day'), 0) AS half,
         COALESCE(SUM(attendance_status = 'Holiday'), 0) AS holidays
       FROM attendance
       WHERE employee_id = ?
         AND attendance_date >= ?
         AND attendance_date < ?`,
      [employeeId, month.start, month.next],
      'Aggregate Functions: COUNT and SUM(boolean) over a date range on the unique key prefix',
    );
    const r = rows[0];
    return {
      ok: true,
      data: {
        totalDaysRecorded: Number(r?.total ?? 0),
        presentDays: Number(r?.present ?? 0),
        absentDays: Number(r?.absent ?? 0),
        halfDays: Number(r?.half ?? 0),
        holidays: Number(r?.holidays ?? 0),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export interface DailyRow {
  employeeId: number;
  name: string;
  /** Null when no attendance row exists for this employee on this date. */
  attendanceId: number | null;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus | null;
}

/**
 * view_attendance for one date, widened to everyone: active employees come
 * first-class via LEFT JOIN so that "not recorded yet" is visible, plus any
 * inactive employee who does have a row that day.
 */
export async function listDailyAttendance(date: string): Promise<DataResult<DailyRow[]>> {
  try {
    const { rows } = await executeQuery<DailyRow[]>(
      `SELECT e.employee_id AS employeeId,
              CONCAT(e.first_name, ' ', e.last_name) AS name,
              a.attendance_id AS attendanceId,
              a.check_in AS checkIn,
              a.check_out AS checkOut,
              a.attendance_status AS status
       FROM employees e
       LEFT JOIN attendance a
              ON a.employee_id = e.employee_id
             AND a.attendance_date = ?
       WHERE e.employment_status = 'Active' OR a.attendance_id IS NOT NULL
       ORDER BY e.first_name, e.last_name, e.employee_id`,
      [date],
      'Relational LEFT JOIN: employees with no attendance row that day keep a NULL status',
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ write */

/**
 * mark_attendance. Validation and role checks have already happened. Confirms
 * the employee exists and is Active, then INSERTs. The pre-check SELECT in the
 * Python code is only a courtesy: the UNIQUE KEY uq_employee_attendance
 * (employee_id, attendance_date) is what actually guarantees one row per
 * employee per day, even for two simultaneous submissions, so a duplicate
 * surfaces here as errno 1062. A single INSERT is atomic, so a failure leaves
 * nothing half-written.
 */
export async function markAttendance(
  input: MarkAttendanceInput,
): Promise<DataResult<{ attendanceId: number }>> {
  try {
    const employee = await executeQuery<Array<{ employee_id: number }>>(
      `SELECT employee_id
       FROM employees
       WHERE employee_id = ? AND employment_status = 'Active'`,
      [input.employeeId],
      'Indexed Primary Key Point Lookup',
    );
    if (employee.rows.length === 0) {
      return { ok: false, kind: 'other', field: 'employeeId', message: 'Active employee not found.' };
    }

    const inserted = await executeQuery<{ insertId: number }>(
      `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, attendance_status)
       VALUES (?, ?, ?, ?, ?)`,
      [input.employeeId, input.date, input.checkIn, input.checkOut, input.status],
      'Unique Key & Constraint Enforcement: uq_employee_attendance, chk_attendance_time, chk_attendance_status',
    );
    return { ok: true, data: { attendanceId: inserted.rows.insertId } };
  } catch (error) {
    const kind = classify(error);
    if (kind === 'duplicate') {
      return {
        ok: false,
        kind,
        field: 'date',
        message:
          'Attendance has already been recorded for this employee on this date. The unique key allows one row per employee per day, so nothing was changed.',
      };
    }
    if (kind === 'check') {
      return {
        ok: false,
        kind,
        field: 'checkOut',
        message:
          'MySQL rejected these times (chk_attendance_time): check-out cannot be earlier than check-in.',
      };
    }
    if (kind === 'reference') {
      return { ok: false, kind, field: 'employeeId', message: 'That employee no longer exists.' };
    }
    return fail(error);
  }
}
