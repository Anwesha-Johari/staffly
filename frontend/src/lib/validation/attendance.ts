/**
 * Attendance input validation. Mirrors backend/employee_backend.py
 * (mark_attendance, view_attendance, monthly_attendance_summary) rule for rule.
 *
 * Pure functions with no I/O, safe to import from client components.
 */

export const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Half Day', 'Holiday'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export function parseId(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const text = raw.trim();
  if (!/^\d{1,10}$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;
}

export function parseAttendanceStatus(raw: string | undefined | null): AttendanceStatus | null {
  if (typeof raw !== 'string') return null;
  return ATTENDANCE_STATUSES.find((s) => s === raw.trim()) ?? null;
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30), else null. */
export function parseIsoDate(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return text;
}

/** HH:MM or HH:MM:SS (the formats Python's time.fromisoformat takes here) -> HH:MM:SS, else null. */
export function parseTime(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  if (hour > 23 || minute > 59 || second > 59) return null;
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
}

/* ----------------------------------------------------------------- month */

export interface MonthRange {
  year: number;
  month: number;
  /** YYYY-MM, as used in the URL and the month input. */
  key: string;
  /** First day of the month, YYYY-MM-DD (inclusive lower bound). */
  start: string;
  /** First day of the following month (exclusive upper bound). */
  next: string;
  daysInMonth: number;
  /** 0 = Monday ... 6 = Sunday, for the first day of the month. */
  firstWeekday: number;
  label: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-10" -> the month's half-open date range, or null when invalid (year 1..9999, month 1..12). */
export function parseMonth(raw: string | undefined | null): MonthRange | null {
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || year > 9999 || month < 1 || month > 12) return null;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const first = new Date(Date.UTC(2000, month - 1, 1));
  first.setUTCFullYear(year);
  return {
    year,
    month,
    key: `${pad(year, 4)}-${pad(month, 2)}`,
    start: `${pad(year, 4)}-${pad(month, 2)}-01`,
    next: `${pad(nextYear, 4)}-${pad(nextMonth, 2)}-01`,
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    firstWeekday: (first.getUTCDay() + 6) % 7,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

/** Today's date (UTC) as YYYY-MM-DD. Call only after request data has been read. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------ mark input */

export type MarkField = 'employeeId' | 'date' | 'status' | 'checkIn' | 'checkOut';

export interface MarkAttendanceInput {
  employeeId: number;
  date: string;
  status: AttendanceStatus;
  /** HH:MM:SS or null. */
  checkIn: string | null;
  /** HH:MM:SS or null. */
  checkOut: string | null;
}

export interface MarkAttendanceRaw {
  employeeId: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
}

/**
 * mark_attendance validation: positive employee id, real date, status from
 * the four allowed values, optional times, and check_out >= check_in (the same
 * rule as CHECK chk_attendance_time).
 */
export function validateMarkAttendance(
  raw: MarkAttendanceRaw,
): { ok: true; value: MarkAttendanceInput } | { ok: false; errors: FieldErrors<MarkField> } {
  const errors: FieldErrors<MarkField> = {};

  const employeeId = parseId(raw.employeeId);
  if (employeeId === null) errors.employeeId = 'Choose an employee.';

  const date = parseIsoDate(raw.date);
  if (date === null) errors.date = 'Enter a valid date (YYYY-MM-DD).';

  const status = parseAttendanceStatus(raw.status);
  if (status === null) errors.status = 'Choose Present, Absent, Half Day or Holiday.';

  let checkIn: string | null = null;
  if (raw.checkIn.trim() !== '') {
    checkIn = parseTime(raw.checkIn);
    if (checkIn === null) errors.checkIn = 'Use HH:MM or HH:MM:SS.';
  }
  let checkOut: string | null = null;
  if (raw.checkOut.trim() !== '') {
    checkOut = parseTime(raw.checkOut);
    if (checkOut === null) errors.checkOut = 'Use HH:MM or HH:MM:SS.';
  }
  if (checkIn && checkOut && checkOut < checkIn) {
    errors.checkOut = 'Check-out cannot be earlier than check-in.';
  }

  if (Object.keys(errors).length > 0 || employeeId === null || date === null || status === null) {
    return { ok: false, errors };
  }
  return { ok: true, value: { employeeId, date, status, checkIn, checkOut } };
}
