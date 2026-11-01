/**
 * Employee validation shared by the client (hints while typing) and the
 * server actions (authoritative). No server-only imports here.
 *
 * Mirrors backend/employee_backend.py: validate_employee, add_employee,
 * update_employee and update_own_contact. Column sizes come from
 * database/schemas.sql (first/last name 50, email 150, phone 20,
 * salary DECIMAL(10,2)).
 */

export const EMPLOYMENT_STATUSES = ['Active', 'Inactive', 'On Leave'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

/** Same pattern as the backend: something@something.tld, no spaces. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const LIMITS = {
  name: 50,
  email: 150,
  phone: 20,
  /** DECIMAL(10,2): eight integer digits plus two decimals. */
  salaryMax: 99_999_999.99,
} as const;

export type EmployeeField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'hire_date'
  | 'salary'
  | 'department_id'
  | 'role_id'
  | 'manager_id'
  | 'employment_status';

export type FieldErrors = Partial<Record<EmployeeField, string>>;

/** Raw strings as they arrive from a form. */
export type EmployeeFormValues = Record<EmployeeField, string>;

/** A validated employee, ready for parameterised SQL. */
export interface EmployeeInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  hire_date: string;
  /** Normalised to two decimals, passed as a string so no float rounding. */
  salary: string;
  department_id: number | null;
  role_id: number | null;
  manager_id: number | null;
  employment_status: EmploymentStatus;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

export const EMPTY_VALUES: EmployeeFormValues = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  hire_date: '',
  salary: '',
  department_id: '',
  role_id: '',
  manager_id: '',
  employment_status: 'Active',
};

const FIELDS = Object.keys(EMPTY_VALUES) as EmployeeField[];

/** Read every known field from FormData as a string (unknown keys ignored). */
export function readEmployeeForm(formData: FormData): EmployeeFormValues {
  const out = { ...EMPTY_VALUES };
  for (const key of FIELDS) {
    const v = formData.get(key);
    out[key] = typeof v === 'string' ? v : out[key];
  }
  return out;
}

export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function validateEmail(raw: string): { value?: string; error?: string } {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: 'Please enter a valid email address.' };
  if (email.length > LIMITS.email) return { error: `Email can be at most ${LIMITS.email} characters.` };
  return { value: email };
}

export function validatePhone(raw: string): { value: string | null; error?: string } {
  const phone = raw.trim();
  if (phone.length > LIMITS.phone) {
    return { value: null, error: `Phone can be at most ${LIMITS.phone} characters.` };
  }
  return { value: phone === '' ? null : phone };
}

/**
 * validate_employee: Decimal(str(salary)), finite, >= 0. We additionally
 * require at most two decimals (the column is DECIMAL(10,2)) and a value
 * that fits the column, so the database never has to round or overflow.
 */
export function validateSalary(raw: string): { value?: string; error?: string } {
  const s = raw.trim();
  if (s === '') return { error: 'Salary is required.' };
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { error: 'Salary must be a valid number.' };
  if (s.startsWith('-')) return { error: 'Salary must be a non-negative number.' };
  const [whole, frac = ''] = s.split('.');
  if (frac.length > 2) return { error: 'Salary can have at most 2 decimal places.' };
  const n = Number(s);
  if (!Number.isFinite(n) || n > LIMITS.salaryMax) {
    return { error: 'Salary is too large (maximum 99,999,999.99).' };
  }
  return { value: `${whole.replace(/^0+(?=\d)/, '')}.${frac.padEnd(2, '0')}` };
}

function parseOptionalId(raw: string, label: string): { value: number | null; error?: string } {
  const s = raw.trim();
  if (s === '') return { value: null };
  if (!/^\d+$/.test(s) || Number(s) <= 0 || Number(s) > 2_147_483_647) {
    return { value: null, error: `${label} is not valid.` };
  }
  return { value: Number(s) };
}

/**
 * Full-record validation for add_employee (mode "create") and
 * update_employee (mode "update", where `selfId` blocks self-management).
 */
export function validateEmployee(
  raw: EmployeeFormValues,
  opts: { mode: 'create' | 'update'; selfId?: number }
): ValidationResult<EmployeeInput> {
  const errors: FieldErrors = {};

  const first = raw.first_name.trim();
  const last = raw.last_name.trim();
  if (!first) errors.first_name = 'First name is required.';
  else if (first.length > LIMITS.name) errors.first_name = `At most ${LIMITS.name} characters.`;
  if (!last) errors.last_name = 'Last name is required.';
  else if (last.length > LIMITS.name) errors.last_name = `At most ${LIMITS.name} characters.`;

  const email = validateEmail(raw.email);
  if (email.error) errors.email = email.error;

  const phone = validatePhone(raw.phone);
  if (phone.error) errors.phone = phone.error;

  if (!raw.hire_date.trim()) errors.hire_date = 'Hire date is required.';
  else if (!isValidIsoDate(raw.hire_date.trim())) errors.hire_date = 'Enter a real date (YYYY-MM-DD).';

  const salary = validateSalary(raw.salary);
  if (salary.error) errors.salary = salary.error;

  const dept = parseOptionalId(raw.department_id, 'Department');
  if (dept.error) errors.department_id = dept.error;
  const role = parseOptionalId(raw.role_id, 'Job role');
  if (role.error) errors.role_id = role.error;
  const mgr = parseOptionalId(raw.manager_id, 'Manager');
  if (mgr.error) errors.manager_id = mgr.error;
  else if (opts.selfId !== undefined && mgr.value === opts.selfId) {
    errors.manager_id = 'An employee cannot be their own manager.';
  }

  let status: EmploymentStatus = 'Active';
  if (opts.mode === 'update') {
    if (!(EMPLOYMENT_STATUSES as readonly string[]).includes(raw.employment_status)) {
      errors.employment_status = 'Invalid employment status.';
    } else {
      status = raw.employment_status as EmploymentStatus;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      first_name: first,
      last_name: last,
      email: email.value as string,
      phone: phone.value,
      hire_date: raw.hire_date.trim(),
      salary: salary.value as string,
      department_id: dept.value,
      role_id: role.value,
      manager_id: mgr.value,
      employment_status: status,
    },
  };
}

/** update_own_contact: only email and phone, both optional but not both absent. */
export interface ContactInput {
  email: string;
  phone: string | null;
}

export function validateContact(raw: Pick<EmployeeFormValues, 'email' | 'phone'>): ValidationResult<ContactInput> {
  const errors: FieldErrors = {};
  const email = validateEmail(raw.email);
  if (email.error) errors.email = email.error;
  const phone = validatePhone(raw.phone);
  if (phone.error) errors.phone = phone.error;
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email: email.value as string, phone: phone.value } };
}

/** Parse a positive integer from untrusted input (route params, searchParams). */
export function parsePositiveInt(raw: string | string[] | undefined, fallback: number): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || !/^\d{1,9}$/.test(s)) return fallback;
  const n = Number(s);
  return n > 0 ? n : fallback;
}
