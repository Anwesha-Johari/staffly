"use client";

import { useActionState } from "react";
import { FormField, Notice, SqlTrace } from "@/components/app";
import { InfoTip } from "@/components/InfoTip";
import { ATTENDANCE_STATUSES } from "@/lib/validation/attendance";
import { markAttendanceAction } from "../actions";

export interface EmployeeChoice {
  employeeId: number;
  name: string;
}

/**
 * "Mark attendance" (mark_attendance): pick any active employee.
 */
export function MarkAttendanceForm({
  employees,
  defaultEmployeeId,
  defaultDate,
}: {
  employees: EmployeeChoice[];
  defaultEmployeeId: number | null;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(markAttendanceAction, null);
  const errors = state?.errors ?? {};
  const values = state?.values;

  return (
    <section className="card p-5" aria-labelledby="mark-attendance-title">
      <h2 id="mark-attendance-title" className="text-[17px] font-medium text-ink">
        Mark attendance
      </h2>
      <p className="mt-0.5 text-[13px] text-muted">
        Record one employee for one day. An existing entry is never overwritten.
      </p>

      <form action={formAction} className="mt-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField label="Employee" htmlFor="att-employee" error={errors.employeeId} required>
            <select
              id="att-employee"
              name="employeeId"
              className="field"
              required
              defaultValue={values?.employeeId ?? (defaultEmployeeId ? String(defaultEmployeeId) : "")}
            >
              <option value="" disabled>
                Choose an employee
              </option>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Date"
            htmlFor="att-date"
            error={errors.date}
            required
            info={
              <>
                The table has <code>UNIQUE (employee_id, attendance_date)</code>: one row per employee per day. If
                that day is already recorded, MySQL refuses the second row (error 1062) and nothing changes. The
                dashboard reports it calmly and never overwrites or deletes the existing entry.
              </>
            }
          >
            <input
              id="att-date"
              name="date"
              type="date"
              className="field"
              required
              defaultValue={values?.date ?? defaultDate}
            />
          </FormField>

          <FormField label="Status" htmlFor="att-status" error={errors.status} required>
            <select id="att-status" name="status" className="field" defaultValue={values?.status ?? "Present"}>
              {ATTENDANCE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Check-in" htmlFor="att-in" error={errors.checkIn} hint="Optional">
            <input
              id="att-in"
              name="checkIn"
              type="time"
              className="field mono"
              defaultValue={values?.checkIn ?? "09:00"}
            />
          </FormField>

          <FormField
            label="Check-out"
            htmlFor="att-out"
            error={errors.checkOut}
            hint="Optional"
            info={
              <>
                <code>CHECK (check_in IS NULL OR check_out IS NULL OR check_out &gt;= check_in)</code>: the database
                itself refuses a check-out earlier than the check-in, even if this form were bypassed. Leave either
                time empty for Absent or Holiday.
              </>
            }
          >
            <input
              id="att-out"
              name="checkOut"
              type="time"
              className="field mono"
              defaultValue={values?.checkOut ?? "17:00"}
            />
          </FormField>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving..." : "Record attendance"}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
            Duplicate days are refused by the database
            <InfoTip title="What happens on a duplicate">
              The INSERT runs once. If <code>uq_employee_attendance</code> already holds that employee and date,
              MySQL raises a duplicate-key error, the statement is undone, and the existing row stays exactly as it
              was.
            </InfoTip>
          </span>
        </div>

        <div aria-live="polite" className="mt-4 empty:hidden">
          {state && !state.ok && (
            <Notice kind={state.duplicate ? "warn" : "bad"}>{state.message}</Notice>
          )}
          {state?.ok && <Notice kind="ok">{state.message}</Notice>}
        </div>
      </form>

      {state && state.sql.length > 0 && <SqlTrace entries={state.sql} />}
    </section>
  );
}
