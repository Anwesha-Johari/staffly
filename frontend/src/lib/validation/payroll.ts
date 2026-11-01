/**
 * Payroll input validation. Mirrors backend/employee_backend.py
 * (generate_payroll, update_payroll_status, view_payroll) rule for rule.
 *
 * Pure functions with no I/O, so they are safe to import from client
 * components (the live net-salary preview uses the same money parser).
 */

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'On Hold'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** DECIMAL(10,2) holds 8 integer digits; the backend enforces < 100000000. */
export const MAX_AMOUNT_EXCLUSIVE_CENTS = 100000000 * 100;

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/* ---------------------------------------------------------------- money */

/**
 * Parse a non-negative amount with at most 2 decimal places into integer
 * cents, so that comparisons and sums never suffer floating point error.
 * Returns an error message instead when the text is not acceptable.
 */
export function parseMoneyToCents(
  raw: string,
  label: string,
  opts: { allowEmpty?: boolean } = {},
): { cents: number } | { error: string } {
  const text = raw.trim();
  if (text === '') {
    return opts.allowEmpty ? { cents: 0 } : { error: `${label} is required.` };
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    return {
      error: `${label} must be a non-negative amount with at most 2 decimal places.`,
    };
  }
  const whole = match[1].replace(/^0+(?=\d)/, '');
  if (whole.length > 8) {
    return { error: `${label} must be less than 100,000,000.` };
  }
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const cents = parseInt(whole, 10) * 100 + parseInt(fraction || '0', 10);
  if (cents >= MAX_AMOUNT_EXCLUSIVE_CENTS) {
    return { error: `${label} must be less than 100,000,000.` };
  }
  return { cents };
}

/** Integer cents -> "1234.50" (the exact text bound to the DECIMAL column). */
export function centsToDecimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/* ---------------------------------------------------------------- month */

function isRealDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= last;
}

/**
 * Normalise "YYYY-MM" (month picker) or any valid "YYYY-MM-DD" to the first
 * day of that month. Used for read-side filters, where a stray day is
 * harmless. Returns null when the text is not a real month.
 */
export function normaliseToFirstOfMonth(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 1;
  if (!isRealDate(year, month, day)) return null;
  return `${match[1]}-${match[2]}-01`;
}

/** First day of the current month (UTC), as YYYY-MM-01. */
export function currentMonthFirstDay(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/**
 * Write-side month rule from generate_payroll: the value must be a real date
 * and its day must be 1. The month picker sends YYYY-MM, which is by
 * definition the first day; an explicit YYYY-MM-DD is accepted only for -01.
 */
export function parsePayMonthStrict(raw: string): { payMonth: string } | { error: string } {
  const text = raw.trim();
  const message = 'Invalid payroll month. Use YYYY-MM-01, such as 2026-11-01.';
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (!match) return { error: message };
  const day = match[3] ? Number(match[3]) : 1;
  if (!isRealDate(Number(match[1]), Number(match[2]), day) || day !== 1) {
    return { error: message };
  }
  return { payMonth: `${match[1]}-${match[2]}-01` };
}

/** "2026-11-01" -> "November 2026". */
export function formatPayMonth(payMonth: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(payMonth);
  if (!match) return payMonth;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** Previous/next month helpers for the month picker links. */
export function shiftMonth(payMonth: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})/.exec(payMonth);
  if (!match) return payMonth;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/* ------------------------------------------------------------ identifiers */

export function parsePositiveInt(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const text = raw.trim();
  if (!/^\d{1,10}$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : null;
}

/* ----------------------------------------------------- generate payroll */

export type GeneratePayrollField =
  | 'employeeId'
  | 'payMonth'
  | 'basicSalary'
  | 'allowances'
  | 'deductions';

export interface GeneratePayrollInput {
  employeeId: number;
  /** YYYY-MM-01 */
  payMonth: string;
  /** Exact decimal text, e.g. "5000.00". */
  basicSalary: string;
  allowances: string;
  deductions: string;
  /** What MySQL will compute for net_salary, for the confirmation message. */
  netCents: number;
}

export function validateGeneratePayroll(raw: {
  employeeId: string;
  payMonth: string;
  basicSalary: string;
  allowances: string;
  deductions: string;
}):
  | { ok: true; value: GeneratePayrollInput }
  | { ok: false; errors: FieldErrors<GeneratePayrollField> } {
  const errors: FieldErrors<GeneratePayrollField> = {};

  const employeeId = parsePositiveInt(raw.employeeId);
  if (employeeId === null) errors.employeeId = 'Choose an employee.';

  const month = parsePayMonthStrict(raw.payMonth);
  if ('error' in month) errors.payMonth = month.error;

  const basic = parseMoneyToCents(raw.basicSalary, 'Basic salary');
  if ('error' in basic) errors.basicSalary = basic.error;
  const allowances = parseMoneyToCents(raw.allowances, 'Allowances', { allowEmpty: true });
  if ('error' in allowances) errors.allowances = allowances.error;
  const deductions = parseMoneyToCents(raw.deductions, 'Deductions', { allowEmpty: true });
  if ('error' in deductions) errors.deductions = deductions.error;

  if ('cents' in basic && 'cents' in allowances && 'cents' in deductions) {
    // chk_payroll_amounts: (basic_salary + allowances) >= deductions
    if (basic.cents + allowances.cents < deductions.cents) {
      errors.deductions = 'Deductions cannot exceed basic salary plus allowances.';
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    employeeId === null ||
    'error' in month ||
    'error' in basic ||
    'error' in allowances ||
    'error' in deductions
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      employeeId,
      payMonth: month.payMonth,
      basicSalary: centsToDecimalString(basic.cents),
      allowances: centsToDecimalString(allowances.cents),
      deductions: centsToDecimalString(deductions.cents),
      netCents: basic.cents + allowances.cents - deductions.cents,
    },
  };
}

/* ------------------------------------------------------- payment status */

/**
 * update_payroll_status does `new_status.strip().title()`, so "on hold" and
 * "PAID" are accepted. Returns null for anything outside the CHECK list.
 */
export function parsePaymentStatus(raw: string | undefined | null): PaymentStatus | null {
  if (typeof raw !== 'string') return null;
  const title = raw
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_m, space: string, ch: string) => space + ch.toUpperCase());
  return (PAYMENT_STATUSES as readonly string[]).includes(title)
    ? (title as PaymentStatus)
    : null;
}

/* --------------------------------------------------------------- display */

const AMOUNT_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 12345.5 -> "12,345.50" (no currency symbol: the schema does not name one). */
export function formatAmount(value: number): string {
  return AMOUNT_FORMAT.format(value);
}
