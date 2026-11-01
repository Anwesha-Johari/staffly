/**
 * Leave input validation. Mirrors backend/employee_backend.py
 * (apply_for_leave, view_leave_requests, review_leave_request).
 *
 * The backend function accepts any non-empty leave type; schemas.sql limits it
 * to VARCHAR(30). The Streamlit UI (backend/app.py) offers the five options
 * below, so the form uses them as a select, but the server only enforces the
 * 1-30 character rule, exactly like apply_for_leave.
 *
 * Pure functions with no I/O, safe to import from client components.
 */
import { parseId, parseIsoDate } from './attendance';

export { parseId, parseIsoDate } from './attendance';

export const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected'] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_DECISIONS = ['Approved', 'Rejected'] as const;
export type LeaveDecision = (typeof LEAVE_DECISIONS)[number];

/** Options offered by the Streamlit UI for apply_for_leave. */
export const LEAVE_TYPE_OPTIONS = ['Annual', 'Sick', 'Maternity', 'Unpaid', 'Other'] as const;

export const LEAVE_TYPE_MAX = 30;
export const LEAVE_REASON_MAX = 255;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function parseLeaveDecision(raw: string | undefined | null): LeaveDecision | null {
  if (typeof raw !== 'string') return null;
  return LEAVE_DECISIONS.find((d) => d === raw.trim()) ?? null;
}

/** Status filter from the URL: a status, or null for "All" (also for anything unrecognised). */
export function parseLeaveStatusFilter(raw: string | undefined | null): LeaveStatus | null {
  if (typeof raw !== 'string') return null;
  return LEAVE_STATUSES.find((s) => s === raw.trim()) ?? null;
}

export type ApplyField = 'employeeId' | 'leaveType' | 'startDate' | 'endDate' | 'reason';

export interface ApplyLeaveInput {
  employeeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  /** Null when left blank. */
  reason: string | null;
}

export interface ApplyLeaveRaw {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/** apply_for_leave validation plus the schema limits (type <= 30, reason <= 255). */
export function validateApplyLeave(
  raw: ApplyLeaveRaw,
): { ok: true; value: ApplyLeaveInput } | { ok: false; errors: FieldErrors<ApplyField> } {
  const errors: FieldErrors<ApplyField> = {};

  const employeeId = parseId(raw.employeeId);
  if (employeeId === null) errors.employeeId = 'Choose an employee.';

  const leaveType = raw.leaveType.trim();
  if (leaveType === '') errors.leaveType = 'Leave type is required.';
  else if (leaveType.length > LEAVE_TYPE_MAX) {
    errors.leaveType = `Leave type must be at most ${LEAVE_TYPE_MAX} characters.`;
  }

  const startDate = parseIsoDate(raw.startDate);
  if (startDate === null) errors.startDate = 'Enter a valid start date.';
  const endDate = parseIsoDate(raw.endDate);
  if (endDate === null) errors.endDate = 'Enter a valid end date.';
  if (startDate && endDate && endDate < startDate) {
    errors.endDate = 'End date cannot be before the start date.';
  }

  const reasonText = raw.reason.trim();
  if (reasonText.length > LEAVE_REASON_MAX) {
    errors.reason = `Reason must be at most ${LEAVE_REASON_MAX} characters.`;
  }

  if (Object.keys(errors).length > 0 || startDate === null || endDate === null || employeeId === null) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { employeeId, leaveType, startDate, endDate, reason: reasonText === '' ? null : reasonText },
  };
}
