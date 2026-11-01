import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DbUnavailable, PageHeader, SqlTrace, StatusChip } from "@/components/app";
import { InfoTip } from "@/components/InfoTip";
import {
  getEmployeeDetail,
  isConnectionError,
  listDepartmentOptions,
  listManagerOptions,
  listRoleOptions,
  type EmployeeDetail,
} from "@/lib/data/employees";
import { captureSql } from "@/lib/trace";
import type { EmployeeFormValues } from "@/lib/validation/employee";
import {
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  updateEmployeeAction,
} from "../actions";
import { EmployeeForm } from "../_components/EmployeeForm";
import { StatusToggle } from "../_components/StatusToggle";

type Params = Promise<{ id: string }>;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function EmployeeDetailPage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Employee" />
          <div className="card-flat h-64 animate-pulse" aria-hidden="true" />
        </>
      }
    >
      <EmployeeDetailContent params={params} />
    </Suspense>
  );
}

function Row({ label, info, children }: { label: string; info?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="flex items-center gap-1.5 text-[12.5px] text-muted">
        {label}
        {info && <InfoTip title={label}>{info}</InfoTip>}
      </dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-flat px-4 py-3">
      <p className="num-serif text-[24px] leading-none text-ink">{value}</p>
      <p className="mt-1 text-[12.5px] text-muted">{label}</p>
    </div>
  );
}

function toFormValues(d: EmployeeDetail): EmployeeFormValues {
  return {
    first_name: d.first_name,
    last_name: d.last_name,
    email: d.email,
    phone: d.phone ?? "",
    hire_date: d.hire_date,
    salary: d.salary.toFixed(2),
    department_id: d.department_id ? String(d.department_id) : "",
    role_id: d.role_id ? String(d.role_id) : "",
    manager_id: d.manager_id ? String(d.manager_id) : "",
    employment_status: d.employment_status,
  };
}

async function EmployeeDetailContent({ params }: { params: Params }) {
  const { id: rawId } = await params;
  if (!/^\d{1,9}$/.test(rawId) || Number(rawId) <= 0) notFound();
  const id = Number(rawId);

  let data;
  try {
    data = await captureSql(async () => {
      const detail = await getEmployeeDetail(id);
      if (!detail) return { detail, departments: [], roles: [], managers: [] };
      return {
        detail,
        departments: await listDepartmentOptions(),
        roles: await listRoleOptions(),
        managers: await listManagerOptions({ keepId: detail.manager_id, excludeId: id }),
      };
    });
  } catch (error) {
    if (isConnectionError(error)) {
      return (
        <>
          <PageHeader title="Employee" />
          <DbUnavailable error={error} />
        </>
      );
    }
    throw error;
  }

  const { detail, departments, roles, managers } = data.result;
  if (!detail) notFound();

  const fullName = `${detail.first_name} ${detail.last_name}`;
  const band =
    detail.role_min_salary !== null || detail.role_max_salary !== null
      ? `${detail.role_min_salary !== null ? money.format(detail.role_min_salary) : "any"} to ${
          detail.role_max_salary !== null ? money.format(detail.role_max_salary) : "any"
        }`
      : null;

  return (
    <>
      <PageHeader
        title={fullName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Employee #{detail.employee_id}</span>
            <StatusChip status={detail.employment_status} />
          </span>
        }
        actions={
          <Link href="/employees" className="btn">
            Back to employees
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="profile-heading" className="card p-5">
          <h2 id="profile-heading" className="mb-1 text-[16px] font-medium text-ink">
            Profile
          </h2>
          <dl className="text-[13.5px]">
            <Row label="Email" info={<>Unique across all employees (<code>uq_employee_email</code>), stored in lower case.</>}>
              {detail.email}
            </Row>
            <Row label="Phone">{detail.phone ?? <span className="text-faint">Not set</span>}</Row>
            <Row label="Hire date">{detail.hire_date}</Row>
            <Row
                label="Salary"
                info={<>Stored as <code>DECIMAL(10,2)</code> with a <code>CHECK (salary &gt;= 0)</code>. </>}
              >
                <span className="num-serif">{money.format(detail.salary)}</span>
                {band && <span className="ml-2 text-[12px] text-faint">role band {band}</span>}
              </Row>
            <Row label="Department">
              {detail.department_name ? (
                <>
                  {detail.department_name}
                  {detail.department_location && <span className="ml-2 text-[12px] text-faint">{detail.department_location}</span>}
                </>
              ) : (
                <span className="text-faint">None</span>
              )}
            </Row>
            <Row label="Job role">{detail.role_title ?? <span className="text-faint">None</span>}</Row>
            <Row
              label="Manager"
              info={<><code>manager_id</code> is a foreign key back into this same table, so a manager is simply another employee row.</>}
            >
              {detail.manager_id ? (
                <>
                  <Link href={`/employees/${detail.manager_id}`} className="text-accent underline underline-offset-2">
                    {detail.manager_name}
                  </Link>
                  {detail.manager_status && detail.manager_status !== "Active" && (
                    <span className="ml-2 align-middle">
                      <StatusChip status={detail.manager_status} />
                    </span>
                  )}
                </>
              ) : (
                <span className="text-faint">No manager</span>
              )}
            </Row>
            <Row label="Direct reports">{detail.report_count}</Row>
            <Row label="Record created">{detail.created_at ?? <span className="text-faint">-</span>}</Row>
          </dl>
          <p className="mt-3 text-[12.5px]">
            <Link href="/under-the-hood#library" className="text-accent underline underline-offset-2">
              See how this join works
            </Link>
          </p>
        </section>

        <section aria-labelledby="linked-heading">
          <h2 id="linked-heading" className="mb-2 flex items-center gap-1.5 text-[16px] font-medium text-ink">
            Linked records
            <InfoTip title="Linked records">
              These counts come from correlated <code>COUNT(*)</code> subqueries on child tables that reference this
              employee through a foreign key. Those tables use <code>ON DELETE CASCADE</code>: deleting the employee
              would delete all of it. That is why people are deactivated instead of deleted.
            </InfoTip>
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Count label="Attendance records" value={detail.attendance_count} />
            <Count label="Leave requests" value={detail.leave_count} />
            <Count label="Payroll records" value={detail.payroll_count} />
          </div>
        </section>
      </div>

      <section aria-labelledby="status-heading" className="card mt-5 p-5">
          <h2 id="status-heading" className="mb-1 flex items-center gap-1.5 text-[16px] font-medium text-ink">
            Employment status
            <InfoTip title="Deactivate instead of delete">
              Deactivating sets the status to Inactive and keeps the row, so attendance, leave and payroll history
              stay intact. Only an Inactive employee can be reactivated. The sign-in account is managed separately
              under Accounts.
            </InfoTip>
          </h2>
          <p className="mb-3 text-[13.5px] text-muted">
            Currently <strong className="font-medium text-ink">{detail.employment_status}</strong>.
            {detail.employment_status === "Inactive"
              ? " Reactivating makes this employee Active again."
              : " Deactivating keeps their historical records."}
          </p>
          <StatusToggle
            employeeId={detail.employee_id}
            name={fullName}
            mode={detail.employment_status === "Inactive" ? "reactivate" : "deactivate"}
            action={detail.employment_status === "Inactive" ? reactivateEmployeeAction : deactivateEmployeeAction}
          />
        </section>

      <section aria-labelledby="edit-heading" className="card mt-5 max-w-3xl p-6">
        <h2 id="edit-heading" className="mb-4 text-[16px] font-medium text-ink">
          Edit details
        </h2>
        <EmployeeForm
          mode="edit"
          action={updateEmployeeAction}
          initial={toFormValues(detail)}
          departments={departments}
          roles={roles}
          managers={managers}
          employeeId={detail.employee_id}
        />
      </section>

      <SqlTrace entries={data.sql} title="Under the hood: SQL that built this page" />
    </>
  );
}
