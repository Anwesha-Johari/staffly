/**
 * Leave data access. Mirrors backend/employee_backend.py
 * (apply_for_leave, view_leave_requests, review_leave_request).
 *
 * Every statement is parameterised and goes through executeQuery so it shows
 * up in the SQL trace. These functions never throw: database failures come
 * back as `{ ok: false }` so that captureSql() still returns the statements
 * that ran before the failure.
 *
 * Written against database/schemas.sql; not exercised against a live MySQL.
 */
import { executeQuery } from '@/lib/db';
import type { ApplyLeaveInput, LeaveDecision, LeaveStatus } from '@/lib/validation/leave';

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

export interface LeaveRow {
  leaveId: number;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  /** YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  reason: string | null;
  leaveStatus: LeaveStatus;
  reviewedBy: number | null;
  reviewerName: string | null;
  /** YYYY-MM-DD HH:MM or null. */
  reviewedAt: string | null;
  appliedAt: string | null;
}

export interface LeaveQuery {
  /** Optional applicant filter; null shows everyone. */
  employeeId: number | null;
  status: LeaveStatus | null;
  limit: number;
  offset: number;
}

function filters(q: Pick<LeaveQuery, 'employeeId' | 'status'>): { where: string; params: Array<number | string> } {
  let where = ' WHERE 1 = 1';
  const params: Array<number | string> = [];
  if (q.employeeId !== null) {
    where += ' AND l.employee_id = ?';
    params.push(q.employeeId);
  }
  if (q.status !== null) {
    where += ' AND l.leave_status = ?';
    params.push(q.status);
  }
  return { where, params };
}

/** view_leave_requests: requests joined to the applicant and (LEFT JOIN) the reviewer, newest first. */
export async function listLeaveRequests(q: LeaveQuery): Promise<DataResult<LeaveRow[]>> {
  const { where, params } = filters(q);
  try {
    const { rows } = await executeQuery<LeaveRow[]>(
      `SELECT l.leave_id AS leaveId,
              l.employee_id AS employeeId,
              CONCAT(e.first_name, ' ', e.last_name) AS employeeName,
              l.leave_type AS leaveType,
              DATE_FORMAT(l.start_date, '%Y-%m-%d') AS startDate,
              DATE_FORMAT(l.end_date, '%Y-%m-%d') AS endDate,
              l.reason AS reason,
              l.leave_status AS leaveStatus,
              l.reviewed_by AS reviewedBy,
              CONCAT(r.first_name, ' ', r.last_name) AS reviewerName,
              DATE_FORMAT(l.reviewed_at, '%Y-%m-%d %H:%i') AS reviewedAt,
              DATE_FORMAT(l.applied_at, '%Y-%m-%d %H:%i') AS appliedAt
       FROM leave_requests l
       JOIN employees e ON l.employee_id = e.employee_id
       LEFT JOIN employees r ON l.reviewed_by = r.employee_id${where}
       ORDER BY l.applied_at DESC, l.leave_id DESC
       LIMIT ${Math.max(1, Math.floor(q.limit))} OFFSET ${Math.max(0, Math.floor(q.offset))}`,
      params,
      'Relational JOIN: applicant, plus a LEFT JOIN for the reviewer (NULL while Pending)',
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

export interface LeaveCounts {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface CountRow {
  total: number | string;
  pending: number | string | null;
  approved: number | string | null;
  rejected: number | string | null;
}

/** One aggregate over the scope (ignores the status filter) for the tab counts. */
export async function leaveCounts(employeeId: number | null): Promise<DataResult<LeaveCounts>> {
  const params: number[] = [];
  let where = '';
  if (employeeId !== null) {
    where = ' WHERE employee_id = ?';
    params.push(employeeId);
  }
  try {
    const { rows } = await executeQuery<CountRow[]>(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(leave_status = 'Pending'), 0) AS pending,
              COALESCE(SUM(leave_status = 'Approved'), 0) AS approved,
              COALESCE(SUM(leave_status = 'Rejected'), 0) AS rejected
       FROM leave_requests${where}`,
      params,
      'Aggregate Functions: COUNT and SUM(boolean) per status',
    );
    const r = rows[0];
    return {
      ok: true,
      data: {
        total: Number(r?.total ?? 0),
        pending: Number(r?.pending ?? 0),
        approved: Number(r?.approved ?? 0),
        rejected: Number(r?.rejected ?? 0),
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export interface ActiveEmployee {
  employeeId: number;
  name: string;
}

/** get_active_employees_for_dropdown: applicants for the leave form. */
export async function listActiveEmployees(): Promise<DataResult<ActiveEmployee[]>> {
  try {
    const { rows } = await executeQuery<ActiveEmployee[]>(
      `SELECT employee_id AS employeeId, CONCAT(first_name, ' ', last_name) AS name
       FROM employees
       WHERE employment_status = 'Active'
       ORDER BY first_name, last_name`,
    );
    return { ok: true, data: rows };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ write */

/**
 * apply_for_leave. The applicant is the employee chosen on the form (there is
 * no sign-in at the moment); status takes its column default ('Pending') and applied_at is set by MySQL. A single
 * INSERT is atomic, so a rejected row leaves nothing behind.
 */
export async function applyForLeave(
  input: ApplyLeaveInput,
): Promise<DataResult<{ leaveId: number }>> {
  try {
    const inserted = await executeQuery<{ insertId: number }>(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [input.employeeId, input.leaveType, input.startDate, input.endDate, input.reason],
      'Constraint Enforcement: chk_leave_dates, fk_leave_employee; leave_status defaults to Pending',
    );
    return { ok: true, data: { leaveId: inserted.rows.insertId } };
  } catch (error) {
    const kind = classify(error);
    if (kind === 'check') {
      return {
        ok: false,
        kind,
        field: 'endDate',
        message: 'MySQL rejected these dates (chk_leave_dates): the end date cannot be before the start date.',
      };
    }
    if (kind === 'reference') {
      return { ok: false, kind, message: 'Your employee record could not be found, so the request was not saved.' };
    }
    return fail(error);
  }
}

export type ReviewOutcome =
  | { outcome: 'reviewed'; leaveId: number; decision: LeaveDecision }
  | { outcome: 'already-reviewed'; leaveId: number; status: LeaveStatus; reviewerName: string | null }
  | { outcome: 'not-found' };

/**
 * review_leave_request. A compare-and-set: the UPDATE only matches while the
 * row is still 'Pending', and MySQL re-checks that under the row lock. If two
 * reviewers click at once, exactly one UPDATE matches (affectedRows = 1); the
 * other sees affectedRows = 0 and is told the request was already reviewed.
 * No read-then-write window exists, so no explicit transaction is needed.
 */
export async function reviewLeaveRequest(
  leaveId: number,
  decision: LeaveDecision,
  reviewerEmployeeId: number,
): Promise<DataResult<ReviewOutcome>> {
  try {
    const updated = await executeQuery(
      `UPDATE leave_requests
       SET leave_status = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE leave_id = ?
         AND leave_status = 'Pending'`,
      [decision, reviewerEmployeeId, leaveId],
      'Compare-and-set UPDATE: WHERE leave_status = Pending lets only one reviewer win',
    );
    if (updated.rowCount > 0) {
      return { ok: true, data: { outcome: 'reviewed', leaveId, decision } };
    }

    // Zero rows matched: find out why, so the message is accurate.
    const current = await executeQuery<
      Array<{ leaveStatus: LeaveStatus; reviewerName: string | null }>
    >(
      `SELECT l.leave_status AS leaveStatus,
              CONCAT(r.first_name, ' ', r.last_name) AS reviewerName
       FROM leave_requests l
       LEFT JOIN employees r ON l.reviewed_by = r.employee_id
       WHERE l.leave_id = ?`,
      [leaveId],
      'Indexed Primary Key Point Lookup',
    );
    const row = current.rows[0];
    if (!row) return { ok: true, data: { outcome: 'not-found' } };
    return {
      ok: true,
      data: { outcome: 'already-reviewed', leaveId, status: row.leaveStatus, reviewerName: row.reviewerName },
    };
  } catch (error) {
    if (classify(error) === 'reference') {
      return { ok: false, kind: 'reference', message: 'Your employee record could not be found, so the review was not saved.' };
    }
    return fail(error);
  }
}
