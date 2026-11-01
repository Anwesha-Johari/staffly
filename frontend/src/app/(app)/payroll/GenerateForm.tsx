'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { FormField, Notice, SqlTrace } from '@/components/app';
import {
  centsToDecimalString,
  formatAmount,
  parseMoneyToCents,
} from '@/lib/validation/payroll';
import { generatePayrollAction } from './actions';

export interface EmployeeOption {
  employeeId: number;
  name: string;
  salary: number;
  status: string;
}

interface Values {
  employeeId: string;
  payMonth: string;
  basicSalary: string;
  allowances: string;
  deductions: string;
}

/** The preview is arithmetic on what is typed; MySQL remains the source of truth. */
function previewNet(v: Values): { net: string; note: string | null } {
  const basic = parseMoneyToCents(v.basicSalary, 'Basic salary');
  const allowances = parseMoneyToCents(v.allowances, 'Allowances', { allowEmpty: true });
  const deductions = parseMoneyToCents(v.deductions, 'Deductions', { allowEmpty: true });
  if ('error' in basic || 'error' in allowances || 'error' in deductions) {
    return { net: '-', note: 'Enter valid amounts to see the preview.' };
  }
  const net = basic.cents + allowances.cents - deductions.cents;
  if (net < 0) {
    return { net: '-', note: 'Deductions exceed basic salary plus allowances; MySQL would reject this.' };
  }
  return { net: formatAmount(net / 100), note: null };
}

export function GenerateForm({
  employees,
  defaultMonth,
}: {
  employees: EmployeeOption[];
  /** YYYY-MM, matches the <input type="month"> value format. */
  defaultMonth: string;
}) {
  const initial: Values = {
    employeeId: '',
    payMonth: defaultMonth,
    basicSalary: '',
    allowances: '0.00',
    deductions: '0.00',
  };
  const [state, formAction, pending] = useActionState(generatePayrollAction, null);
  const [values, setValues] = useState<Values>(initial);

  // Clear the amounts once, when a new successful result arrives (derived-state
  // pattern from the React docs; avoids an effect).
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setValues({ ...initial, payMonth: values.payMonth });
    }
  }

  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const errors = state && !state.ok ? state.errors : {};
  const preview = previewNet(values);
  const selected = employees.find((e) => String(e.employeeId) === values.employeeId);

  return (
    <section className="card p-5" aria-labelledby="generate-title">
      <div className="mb-4 flex items-center gap-2">
        <h2 id="generate-title" className="text-[17px] font-medium text-ink">
          Generate payroll
        </h2>
        <InfoTip title="One payslip per employee per month">
          The table has <code>UNIQUE (employee_id, pay_month)</code>, so MySQL refuses a second
          payslip for the same employee and month. The app also checks first, to give a friendly
          message, but the constraint is the real guarantee even if two people submit at once.
        </InfoTip>
      </div>

      <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" noValidate>
        <FormField label="Employee" htmlFor="gp-employee" required error={errors.employeeId}>
          <select
            id="gp-employee"
            name="employeeId"
            className="field"
            value={values.employeeId}
            onChange={set('employeeId')}
            required
          >
            <option value="">Select an employee</option>
            {employees.map((e) => (
              <option key={e.employeeId} value={e.employeeId}>
                {e.name}
                {e.status !== 'Active' ? ` (${e.status})` : ''}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Pay month"
          htmlFor="gp-month"
          required
          error={errors.payMonth}
          hint="Stored as the first day of the month."
          info={
            <>
              <code>pay_month</code> is a <code>DATE</code> column, so a month is stored as its first
              day (for example <code>2026-11-01</code>). Picking a month here always produces that
              form; the backend rejects any other day.
            </>
          }
        >
          <input
            id="gp-month"
            name="payMonth"
            type="month"
            className="field"
            value={values.payMonth}
            onChange={set('payMonth')}
            required
          />
        </FormField>

        <FormField
          label="Basic salary"
          htmlFor="gp-basic"
          required
          error={errors.basicSalary}
          hint={
            selected ? (
              <>
                Salary on file: {formatAmount(selected.salary)}{' '}
                <button
                  type="button"
                  className="text-accent underline underline-offset-2"
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      basicSalary: centsToDecimalString(Math.round(selected.salary * 100)),
                    }))
                  }
                >
                  use as basic
                </button>
              </>
            ) : (
              'Up to 2 decimal places, below 100,000,000.'
            )
          }
          info={
            <>
              Amounts are <code>DECIMAL(10,2)</code>: exact decimals, never floating point, so money
              does not drift. Rule <code>chk_payroll_amounts</code> also requires all amounts to be
              non-negative.
            </>
          }
        >
          <input
            id="gp-basic"
            name="basicSalary"
            inputMode="decimal"
            autoComplete="off"
            className="field"
            value={values.basicSalary}
            onChange={set('basicSalary')}
            required
          />
        </FormField>

        <FormField label="Allowances" htmlFor="gp-allow" error={errors.allowances}>
          <input
            id="gp-allow"
            name="allowances"
            inputMode="decimal"
            autoComplete="off"
            className="field"
            value={values.allowances}
            onChange={set('allowances')}
          />
        </FormField>

        <FormField
          label="Deductions"
          htmlFor="gp-deduct"
          error={errors.deductions}
          info={
            <>
              <code>chk_payroll_amounts</code> is a table CHECK constraint:{' '}
              <code>(basic_salary + allowances) &gt;= deductions</code>. The form checks it first,
              but MySQL enforces it regardless, so a bad row can never be stored.
            </>
          }
        >
          <input
            id="gp-deduct"
            name="deductions"
            inputMode="decimal"
            autoComplete="off"
            className="field"
            value={values.deductions}
            onChange={set('deductions')}
          />
        </FormField>

        <div>
          <div className="mb-1 flex items-center gap-1.5">
            <span className="field-label !mb-0">Net salary (preview)</span>
            <InfoTip title="Net salary is computed by MySQL">
              <code>net_salary</code> is a <code>GENERATED ALWAYS AS (basic_salary + allowances -
              deductions) STORED</code> column. The INSERT never names it: MySQL calculates and stores
              it, and no application code can set it to a different value. This figure is only a
              preview of what MySQL will compute; the saved value is read back afterwards.
            </InfoTip>
          </div>
          <div
            className="card-flat flex min-h-[38px] items-center px-3 py-1.5"
            aria-live="polite"
            data-testid="net-preview"
          >
            <span className="num-serif text-[18px] text-ink">{preview.net}</span>
          </div>
          <p className="mt-1 text-[12px] text-faint">
            {preview.note ?? 'net = basic + allowances - deductions'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Generating...' : 'Generate payslip'}
          </button>
          <p className="text-[12.5px] text-muted">New payslips start as Pending.</p>
        </div>
      </form>

      <div className="mt-4" aria-live="polite">
        {state?.ok && (
          <Notice kind="ok">
            {state.message} MySQL computed net salary {formatAmount(Number(state.netSalary))}.{' '}
            <Link
              href={`/payroll/${state.payrollId}`}
              className="underline underline-offset-2"
            >
              Open payslip
            </Link>{' '}
            or{' '}
            <Link
              href={`/payroll?month=${state.payMonth.slice(0, 7)}`}
              className="underline underline-offset-2"
            >
              view that month
            </Link>
            .
          </Notice>
        )}
        {state && !state.ok && (
          <Notice kind={state.unavailable ? 'warn' : 'bad'}>{state.message}</Notice>
        )}
      </div>

      {state && state.sql.length > 0 && (
        <SqlTrace entries={state.sql} title="Under the hood: SQL for this payslip" />
      )}
    </section>
  );
}
