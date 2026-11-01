"use client";

import { useActionState } from "react";
import { FormField, Notice, SqlTrace } from "@/components/app";
import { InfoTip } from "@/components/InfoTip";
import { LEAVE_REASON_MAX, LEAVE_TYPE_OPTIONS } from "@/lib/validation/leave";
import { applyForLeaveAction } from "../actions";

export interface ApplicantChoice {
  employeeId: number;
  name: string;
}

/** apply_for_leave: the new request always starts as Pending. */
export function ApplyLeaveForm({
  employees,
  defaultEmployeeId,
}: {
  employees: ApplicantChoice[];
  defaultEmployeeId: number | null;
}) {
  const [state, formAction, pending] = useActionState(applyForLeaveAction, null);
  const errors = state?.errors ?? {};
  const values = state?.values;

  return (
    <section className="card p-5" aria-labelledby="apply-leave-title">
      <div className="flex items-center gap-1.5">
        <h2 id="apply-leave-title" className="text-[17px] font-medium text-ink">
          Apply for leave
        </h2>
        <InfoTip title="Leave status workflow">
          A new request is saved as <code>Pending</code>. An Admin or HR reviewer then moves it once, to{" "}
          <code>Approved</code> or <code>Rejected</code>. The database also checks{" "}
          <code>CHECK (end_date &gt;= start_date)</code>, so an end date before the start date is refused even if
          this form were bypassed.
        </InfoTip>
      </div>

      <form action={formAction} className="mt-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Employee" htmlFor="lv-employee" error={errors.employeeId} required>
            <select
              id="lv-employee"
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

          <FormField label="Leave type" htmlFor="lv-type" error={errors.leaveType} required>
            <select id="lv-type" name="leaveType" className="field" defaultValue={values?.leaveType ?? "Annual"}>
              {LEAVE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Start date" htmlFor="lv-start" error={errors.startDate} required>
            <input id="lv-start" name="startDate" type="date" className="field" required defaultValue={values?.startDate ?? ""} />
          </FormField>

          <FormField label="End date" htmlFor="lv-end" error={errors.endDate} required hint="On or after the start date">
            <input id="lv-end" name="endDate" type="date" className="field" required defaultValue={values?.endDate ?? ""} />
          </FormField>
        </div>

        <div className="mt-4 max-w-2xl">
          <FormField label="Reason" htmlFor="lv-reason" error={errors.reason} hint={`Optional, up to ${LEAVE_REASON_MAX} characters`}>
            <textarea
              id="lv-reason"
              name="reason"
              rows={2}
              maxLength={LEAVE_REASON_MAX}
              className="field"
              defaultValue={values?.reason ?? ""}
            />
          </FormField>
        </div>

        <div className="mt-4">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Submitting..." : "Submit request"}
          </button>
        </div>

        <div aria-live="polite" className="mt-4 empty:hidden">
          {state && !state.ok && <Notice kind="bad">{state.message}</Notice>}
          {state?.ok && <Notice kind="ok">{state.message}</Notice>}
        </div>
      </form>

      {state && state.sql.length > 0 && <SqlTrace entries={state.sql} />}
    </section>
  );
}
