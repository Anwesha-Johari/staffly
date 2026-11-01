import Link from "next/link";
import { Suspense } from "react";
import { DbUnavailable, EmptyState, PageHeader, Pagination, SqlTrace, StatusChip } from "@/components/app";
import { InfoTip } from "@/components/InfoTip";
import {
  PAGE_SIZE,
  isConnectionError,
  listDepartmentOptions,
  listEmployees,
  parseStatus,
} from "@/lib/data/employees";
import { captureSql } from "@/lib/trace";
import { EMPLOYMENT_STATUSES, parsePositiveInt } from "@/lib/validation/employee";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function hrefFor(params: { q?: string; status?: string | null; dept?: number | null; page?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  if (params.dept) sp.set("dept", String(params.dept));
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/employees?${qs}` : "/employees";
}

export default function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Employees" />
          <div className="card-flat h-64 animate-pulse" aria-hidden="true" />
        </>
      }
    >
      <EmployeesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function EmployeesContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const q = first(sp.q).trim().slice(0, 100);
  const status = parseStatus(first(sp.status));
  const deptId = parsePositiveInt(first(sp.dept), 0) || null;
  const requestedPage = parsePositiveInt(first(sp.page), 1);

  let data;
  try {
    data = await captureSql(async () => {
      const list = await listEmployees({ search: q, status, departmentId: deptId, page: requestedPage });
      const departments = await listDepartmentOptions();
      return { list, departments };
    });
  } catch (error) {
    if (isConnectionError(error)) {
      return (
        <>
          <PageHeader title="Employees" />
          <DbUnavailable error={error} />
        </>
      );
    }
    throw error;
  }

  const { list, departments } = data.result;
  const pageCount = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const filtered = Boolean(q || status || deptId);
  const from = list.total === 0 ? 0 : (list.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(list.page * PAGE_SIZE, list.total);
  const allCount = Object.values(list.statusCounts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone on the payroll, with department, role and manager resolved by joins."
        actions={
          <Link href="/employees/new" className="btn btn-primary">
            Add employee
          </Link>
        }
      />

      <nav aria-label="Filter by employment status" className="mb-4 flex flex-wrap items-center gap-1 border-b border-line">
          {[null, ...EMPLOYMENT_STATUSES].map((s) => {
            const active = status === s;
            const count = s === null ? allCount : list.statusCounts[s] ?? 0;
            return (
              <Link
                key={s ?? "all"}
                href={hrefFor({ q, status: s, dept: deptId })}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] ${
                  active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {s ?? "All"} <span className="num-serif ml-1 text-[12px] text-faint">{count}</span>
              </Link>
            );
          })}
          <span className="ml-1 pb-0.5">
            <InfoTip title="Employment status" side="bottom">
              <strong>Active</strong> people are working now. <strong>On Leave</strong> people are still employed but
              away for a period (their record stays current). <strong>Inactive</strong> people have left; the row is
              kept so attendance, leave and payroll history stay intact.
            </InfoTip>
          </span>
        </nav>

      <form method="get" action="/employees" role="search" className="mb-5 flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div className="min-w-[260px] flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <label htmlFor="q" className="field-label !mb-0">
              Search
            </label>
            <InfoTip title="How the search works">
              A number looks up the employee ID (a primary-key lookup). Text containing <code>@</code> matches the
              email exactly, ignoring case. Anything else matches part of the name. The <code>LOWER(email)</code> call
              and a <code>LIKE &apos;%text%&apos;</code> pattern that starts with a wildcard cannot use an index, so MySQL
              reads every row; fine for a small company, slow for millions.
            </InfoTip>
          </div>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            className="field"
            placeholder="ID, name or email"
            maxLength={100}
            autoComplete="off"
          />
        </div>
        <div className="w-56">
            <label htmlFor="dept" className="field-label">
              Department
            </label>
            <select id="dept" name="dept" className="field" defaultValue={deptId ? String(deptId) : ""}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.value} value={String(d.value)}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary">
            Apply
          </button>
          {filtered && (
            <Link href={hrefFor({ status: null })} className="btn">
              Clear
            </Link>
          )}
        </div>
      </form>

      {list.rows.length === 0 ? (
        <EmptyState
          title={filtered ? "No employees match these filters" : "No employees yet"}
          body={
            filtered
              ? "Try a different search term, or clear the filters."
              : "Add the first employee to see them here."
          }
          action={
            filtered ? (
              <Link href="/employees" className="btn">
                Clear filters
              </Link>
            ) : (
              <Link href="/employees/new" className="btn btn-primary">
                Add employee
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <caption className="sr-only">Employees, page {list.page} of {pageCount}</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Department</th>
                  <th scope="col">Job role</th>
                  <th scope="col">
                    <span className="inline-flex items-center gap-1.5">
                      Manager
                      <InfoTip title="Manager (self-join)" label="More information about the Manager column">
                        <code>manager_id</code> points to another row of the same <code>employees</code> table. The
                        query joins the table to itself (<code>LEFT JOIN employees m</code>) to turn that id into a name.
                        It is a LEFT JOIN so people without a manager still appear.
                      </InfoTip>
                    </span>
                  </th>
                  <th scope="col">Hired</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((r) => (
                  <tr key={r.employee_id}>
                    <td className="num-serif text-muted">{r.employee_id}</td>
                    <td>
                      <Link href={`/employees/${r.employee_id}`} className="font-medium text-ink underline-offset-2 hover:text-accent hover:underline">
                        {r.first_name} {r.last_name}
                      </Link>
                    </td>
                    <td className="text-muted">{r.email}</td>
                    <td>{r.department_name ?? <span className="text-faint">-</span>}</td>
                    <td>{r.role_title ?? <span className="text-faint">-</span>}</td>
                    <td>
                      {r.manager_id ? (
                        <Link href={`/employees/${r.manager_id}`} className="underline-offset-2 hover:text-accent hover:underline">
                          {r.manager_name}
                        </Link>
                      ) : (
                        <span className="text-faint">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-muted">{r.hire_date}</td>
                    <td>
                      <StatusChip status={r.employment_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
            <p>
              Showing {from}-{to} of {list.total}
            </p>
            <Link href="/under-the-hood#library" className="text-accent underline underline-offset-2">
              See how this join works
            </Link>
          </div>
          <Pagination
            page={list.page}
            pageCount={pageCount}
            makeHref={(p) => hrefFor({ q, status, dept: deptId, page: p })}
          />
        </>
      )}

      <SqlTrace entries={data.sql} title="Under the hood: SQL that built this list" />
    </>
  );
}
