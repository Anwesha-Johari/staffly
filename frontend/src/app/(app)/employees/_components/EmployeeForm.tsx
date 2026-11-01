"use client";

import Link from "next/link";
import { useActionState, useState, type FocusEvent } from "react";
import { FormField, Notice, SqlTrace } from "@/components/app";
import {
  EMPLOYMENT_STATUSES,
  readEmployeeForm,
  validateEmployee,
  type EmployeeField,
  type EmployeeFormValues,
  type FieldErrors,
} from "@/lib/validation/employee";
import { IDLE, type EmployeeFormState } from "../form-state";

export interface SelectOption {
  value: number;
  label: string;
}

type Action = (prev: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>;

/**
 * Client-side hints: re-run the shared validator when a field loses focus and
 * show only that field's message. The server action runs the same validator
 * again and is the authority; hints are stored against the server state they
 * were computed for, so a fresh server response replaces them.
 */
function useHints(
  state: EmployeeFormState,
  validate: (values: EmployeeFormValues) => FieldErrors
) {
  const [hints, setHints] = useState<{ forState: EmployeeFormState; map: Partial<Record<EmployeeField, string>> }>({
    forState: state,
    map: {},
  });
  const live = hints.forState === state ? hints.map : {};

  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    const name = (e.target as unknown as { name?: string }).name as EmployeeField;
    if (!name || !e.currentTarget) return;
    const errors = validate(readEmployeeForm(new FormData(e.currentTarget)));
    setHints({ forState: state, map: { ...live, [name]: errors[name] ?? "" } });
  };

  const errorFor = (name: EmployeeField): string | undefined =>
    name in live ? live[name] || undefined : state.errors?.[name];

  return { onBlur, errorFor };
}

function Result({ state, children }: { state: EmployeeFormState; children?: React.ReactNode }) {
  if (state.status === "success") {
    return (
      <Notice kind="ok" className="mb-5">
        {state.message} {children}
      </Notice>
    );
  }
  if (state.status === "error" && state.message) {
    return (
      <Notice kind="bad" className="mb-5">
        {state.message}
      </Notice>
    );
  }
  return null;
}

const INFO = {
  email: (
    <>
      Emails are stored in lower case and the column has a <code>UNIQUE</code> key (<code>uq_employee_email</code>),
      so no two employees can share one. The form checks first for a friendly message; the unique index is
      still the real guard if two people save at the same moment (MySQL error 1062).
    </>
  ),
  salary: (
    <>
      Stored as <code>DECIMAL(10,2)</code>, so money is exact (no floating-point drift). A <code>CHECK</code>{" "}
      constraint (<code>chk_employee_salary</code>) makes the database itself refuse a negative salary, even if
      some other program writes to it.
    </>
  ),
  hire: (
    <>
      A <code>DATE</code> column that is <code>NOT NULL</code>: every employee needs a hire date.
    </>
  ),
  department: (
    <>
      A foreign key to <code>departments</code>. It is optional: if a department is later deleted, the column is
      set to NULL (<code>ON DELETE SET NULL</code>) instead of deleting people.
    </>
  ),
  role: (
    <>
      A foreign key to <code>job_roles</code>, optional in the same way. The role&apos;s salary band is shown for
      reference but is not enforced.
    </>
  ),
  manager: (
    <>
      <code>manager_id</code> points back into the same <code>employees</code> table (a self-reference), so a
      manager is just another employee. The list page resolves the name with a self-join. Only active employees are
      offered, and nobody can manage themselves.
    </>
  ),
  status: (
    <>
      <strong>Active</strong>: currently employed. <strong>On Leave</strong>: still employed but away for a while;
      the record and the work history stay current. <strong>Inactive</strong>: no longer employed; the row is kept
      for history. A <code>CHECK</code> constraint (<code>chk_employment_status</code>) allows only these three values.
    </>
  ),
  phone: <>Optional, up to 20 characters. Leave it empty to store NULL.</>,
};

/* --------------------------------------------------------------- full form */

export function EmployeeForm({
  mode,
  action,
  initial,
  departments,
  roles,
  managers,
  employeeId,
}: {
  mode: "create" | "edit";
  action: Action;
  initial: EmployeeFormValues;
  departments: SelectOption[];
  roles: SelectOption[];
  managers: SelectOption[];
  /** Edit mode only: the row being edited. */
  employeeId?: number;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const { onBlur, errorFor } = useHints(state, (values) => {
    const r = validateEmployee(values, { mode: mode === "edit" ? "update" : "create", selfId: employeeId });
    return r.ok ? {} : r.errors;
  });

  const v = (name: EmployeeField): string => state.values?.[name] ?? initial[name];
  // Remount after a successful save so the fields pick up fresh server values.
  const formKey = state.status === "success" ? `ok-${state.id}-${state.sql?.[0]?.id ?? ""}` : "form";

  return (
    <div>
      <Result state={state}>
        {mode === "create" && state.id ? (
          <Link href={`/employees/${state.id}`} className="text-accent underline underline-offset-2">
            Open employee #{state.id}
          </Link>
        ) : null}
      </Result>

      <form key={formKey} action={formAction} onBlur={onBlur} noValidate className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        {mode === "edit" && <input type="hidden" name="employee_id" value={employeeId} />}

        <FormField label="First name" htmlFor="first_name" required error={errorFor("first_name")}>
          <input id="first_name" name="first_name" className="field" autoComplete="off" required maxLength={50} defaultValue={v("first_name")} />
        </FormField>
        <FormField label="Last name" htmlFor="last_name" required error={errorFor("last_name")}>
          <input id="last_name" name="last_name" className="field" autoComplete="off" required maxLength={50} defaultValue={v("last_name")} />
        </FormField>

        <FormField label="Email" htmlFor="email" required info={INFO.email} hint="Saved in lower case." error={errorFor("email")}>
          <input id="email" name="email" type="email" className="field" autoComplete="off" required maxLength={150} defaultValue={v("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" info={INFO.phone} error={errorFor("phone")}>
          <input id="phone" name="phone" type="tel" className="field" autoComplete="off" maxLength={20} defaultValue={v("phone")} />
        </FormField>

        <FormField label="Hire date" htmlFor="hire_date" required info={INFO.hire} error={errorFor("hire_date")}>
          <input id="hire_date" name="hire_date" type="date" className="field" required defaultValue={v("hire_date")} />
        </FormField>
        <FormField label="Salary" htmlFor="salary" required info={INFO.salary} hint="Zero or more, up to two decimals." error={errorFor("salary")}>
          <input id="salary" name="salary" inputMode="decimal" className="field" autoComplete="off" required defaultValue={v("salary")} />
        </FormField>

        <FormField label="Department" htmlFor="department_id" info={INFO.department} error={errorFor("department_id")}>
          <select id="department_id" name="department_id" className="field" defaultValue={v("department_id")}>
            <option value="">None</option>
            {departments.map((o) => (
              <option key={o.value} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Job role" htmlFor="role_id" info={INFO.role} error={errorFor("role_id")}>
          <select id="role_id" name="role_id" className="field" defaultValue={v("role_id")}>
            <option value="">None</option>
            {roles.map((o) => (
              <option key={o.value} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Manager" htmlFor="manager_id" info={INFO.manager} error={errorFor("manager_id")}>
          <select id="manager_id" name="manager_id" className="field" defaultValue={v("manager_id")}>
            <option value="">No manager</option>
            {managers.map((o) => (
              <option key={o.value} value={String(o.value)}>{o.label}</option>
            ))}
          </select>
        </FormField>

        {mode === "edit" ? (
          <FormField label="Employment status" htmlFor="employment_status" info={INFO.status} error={errorFor("employment_status")}>
            <select id="employment_status" name="employment_status" className="field" defaultValue={v("employment_status")}>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>
        ) : (
          <p className="self-end pb-2 text-[12.5px] text-muted">
            New employees start as <strong className="font-medium text-ink">Active</strong>.
          </p>
        )}

        <div className="flex items-center gap-3 md:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving..." : mode === "create" ? "Add employee" : "Save changes"}
          </button>
          {mode === "create" && (
            <Link href="/employees" className="btn">
              Cancel
            </Link>
          )}
        </div>
      </form>

      {state.sql && state.sql.length > 0 && <SqlTrace entries={state.sql} title="Under the hood: SQL this save ran" />}
    </div>
  );
}
