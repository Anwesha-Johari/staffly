import Link from "next/link";
import { InfoTip } from "@/components/InfoTip";
import { executeQuery } from "@/lib/db";
import { captureSql } from "@/lib/trace";
import { StatusChip } from "../StatusChip";
import { EmptyState } from "../EmptyState";
import { SqlTrace } from "../SqlTrace";
import { formatDate } from "../format";

/** First day of the current month, computed by MySQL (a constant expression, no user input). */
const MONTH_START = "DATE_SUB(CURRENT_DATE, INTERVAL DAYOFMONTH(CURRENT_DATE) - 1 DAY)";

interface Kpis {
  active_employees: number;
  departments: number;
  pending_leave: number;
  pending_payroll: number;
}
interface Hire {
  employee_id: number;
  first_name: string;
  last_name: string;
  hire_date: Date | string;
  department_name: string | null;
  role_title: string | null;
  employment_status: string;
}
interface PendingLeave {
  leave_id: number;
  employee_name: string;
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
}
interface Headcount {
  department_id: number;
  department_name: string;
  headcount: number;
}

/**
 * Admin / HR overview. Throws if the database is unreachable; the page
 * catches that and renders <DbUnavailable />. Sections run one after another
 * so each SqlTrace lists only its own statements.
 */
export async function AdminHome() {
  const kpis = await captureSql(async () => {
    const { rows } = await executeQuery<Kpis[]>(
      `SELECT
         (SELECT COUNT(*) FROM employees WHERE employment_status = 'Active') AS active_employees,
         (SELECT COUNT(*) FROM departments) AS departments,
         (SELECT COUNT(*) FROM leave_requests WHERE leave_status = 'Pending') AS pending_leave,
         (SELECT COUNT(*) FROM payroll
           WHERE payment_status = 'Pending' AND pay_month = ${MONTH_START}) AS pending_payroll`,
      [],
      "Aggregate functions: four COUNT(*) subqueries in one round trip",
    );
    return rows[0];
  });

  const hires = await captureSql(async () => {
    const { rows } = await executeQuery<Hire[]>(
      `SELECT e.employee_id, e.first_name, e.last_name, e.hire_date, e.employment_status,
              d.department_name, j.role_title
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.department_id
         LEFT JOIN job_roles j ON e.role_id = j.role_id
        ORDER BY e.hire_date DESC, e.employee_id DESC
        LIMIT 5`,
      [],
      "LEFT JOIN: keep employees that have no department or role yet",
    );
    return rows;
  });

  const leave = await captureSql(async () => {
    const { rows } = await executeQuery<PendingLeave[]>(
      `SELECT l.leave_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
              l.leave_type, l.start_date, l.end_date
         FROM leave_requests l
         JOIN employees e ON l.employee_id = e.employee_id
        WHERE l.leave_status = 'Pending'
        ORDER BY l.applied_at DESC, l.leave_id DESC
        LIMIT 5`,
      [],
      "JOIN + filter: pending requests with the employee's name",
    );
    return rows;
  });

  const heads = await captureSql(async () => {
    const { rows } = await executeQuery<Headcount[]>(
      `SELECT d.department_id, d.department_name, COUNT(e.employee_id) AS headcount
         FROM departments d
         LEFT JOIN employees e
           ON e.department_id = d.department_id AND e.employment_status = 'Active'
        GROUP BY d.department_id, d.department_name
        ORDER BY headcount DESC, d.department_name`,
      [],
      "GROUP BY with LEFT JOIN: departments with zero employees still appear",
    );
    return rows;
  });

  const k = kpis.result;
  const maxHead = Math.max(1, ...heads.result.map((h) => Number(h.headcount)));

  return (
    <div className="space-y-8">
      <section aria-label="Key figures">
        <ul className="grid grid-cols-2 gap-4 min-[1100px]:grid-cols-4">
          <Kpi
            label="Active employees"
            value={Number(k.active_employees)}
            href="/employees"
            info={
              <>
                Employees whose <code>employment_status</code> is Active. Inactive staff keep their record
                (and history) but are not counted.
              </>
            }
          />
          <Kpi
            label="Departments"
            value={Number(k.departments)}
            info={<>Rows in the <code>departments</code> table. Each employee belongs to at most one.</>}
          />
          <Kpi
            label="Pending leave requests"
            value={Number(k.pending_leave)}
            href="/leave"
            info={<>Leave requests still waiting for an Admin or HR decision.</>}
          />
          <Kpi
            label="Payroll pending this month"
            value={Number(k.pending_payroll)}
            href="/payroll"
            info={
              <>
                Payroll rows for the current month (stored as the first day of the month) whose payment status
                is still Pending.
              </>
            }
          />
        </ul>
        <SqlTrace entries={kpis.sql} title="Under the hood: SQL for the figures above" />
      </section>

      <div className="grid gap-6 min-[1100px]:grid-cols-5">
        <section className="card p-5 min-[1100px]:col-span-3" aria-labelledby="hires-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="hires-title" className="text-[16px] font-medium text-ink">
              Recent hires
            </h2>
            <Link href="/employees" className="text-[13px] text-muted underline underline-offset-2 hover:text-accent">
              All employees
            </Link>
          </div>
          {hires.result.length === 0 ? (
            <EmptyState title="No employees yet" body="Hires will appear here as soon as the first employee is added." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Department</th>
                    <th scope="col">Hired</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hires.result.map((h) => (
                    <tr key={h.employee_id}>
                      <td>
                        <Link href={`/employees/${h.employee_id}`} className="font-medium text-ink hover:text-accent">
                          {h.first_name} {h.last_name}
                        </Link>
                        <div className="text-[12px] text-faint">{h.role_title ?? "No role assigned"}</div>
                      </td>
                      <td className="text-muted">{h.department_name ?? "Unassigned"}</td>
                      <td className="whitespace-nowrap text-muted">{formatDate(h.hire_date)}</td>
                      <td>
                        <StatusChip status={h.employment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SqlTrace entries={hires.sql} />
        </section>

        <section className="card p-5 min-[1100px]:col-span-2" aria-labelledby="leave-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="leave-title" className="text-[16px] font-medium text-ink">
              Pending leave
            </h2>
            <Link href="/leave" className="text-[13px] text-muted underline underline-offset-2 hover:text-accent">
              Review
            </Link>
          </div>
          {leave.result.length === 0 ? (
            <EmptyState title="Nothing waiting" body="Every leave request has been decided." />
          ) : (
            <ul className="divide-y divide-line">
              {leave.result.map((l) => (
                <li key={l.leave_id}>
                  <Link href="/leave" className="block rounded-lg px-1 py-2.5 hover:bg-surface-2">
                    <span className="block text-[13.5px] font-medium text-ink">{l.employee_name}</span>
                    <span className="block text-[12.5px] text-muted">
                      {l.leave_type}, {formatDate(l.start_date)} to {formatDate(l.end_date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <SqlTrace entries={leave.sql} />
        </section>
      </div>

      <section className="card p-5" aria-labelledby="headcount-title">
        <h2 id="headcount-title" className="mb-1 flex items-center gap-1.5 text-[16px] font-medium text-ink">
          Headcount by department
          <InfoTip title="Why a LEFT JOIN?">
            A plain JOIN would drop departments that have no active employees. LEFT JOIN keeps every
            department and GROUP BY counts the matching employees, so empty departments show a zero.
          </InfoTip>
        </h2>
        <p className="mb-4 text-[13px] text-muted">Active employees only.</p>
        {heads.result.length === 0 ? (
          <EmptyState title="No departments yet" body="Departments will be listed here once they are created." />
        ) : (
          <ul className="space-y-2.5">
            {heads.result.map((h) => {
              const n = Number(h.headcount);
              return (
                <li key={h.department_id} className="grid grid-cols-[minmax(110px,200px)_1fr_40px] items-center gap-3">
                  <span className="truncate text-[13.5px] text-ink">{h.department_name}</span>
                  <span
                    className="h-2 rounded-full bg-surface-2"
                    role="img"
                    aria-label={`${h.department_name}: ${n} active employee${n === 1 ? "" : "s"}`}
                  >
                    <span
                      className="block h-2 rounded-full bg-muted"
                      style={{ width: `${n === 0 ? 0 : Math.max(3, (n / maxHead) * 100)}%` }}
                    />
                  </span>
                  <span className="num-serif text-right text-[14px] text-ink">{n}</span>
                </li>
              );
            })}
          </ul>
        )}
        <SqlTrace entries={heads.sql} />
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  info,
  href,
}: {
  label: string;
  value: number;
  info: React.ReactNode;
  href?: string;
}) {
  return (
    <li className="card p-4">
      <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
        {label}
        <InfoTip title={label}>{info}</InfoTip>
      </p>
      <p className="num-serif mt-2 text-[34px] leading-none text-ink">{value.toLocaleString("en-US")}</p>
      {href ? (
        <Link href={href} className="mt-3 inline-block text-[12.5px] text-muted underline underline-offset-2 hover:text-accent">
          View
        </Link>
      ) : (
        <span className="mt-3 inline-block text-[12.5px] text-transparent" aria-hidden="true">
          .
        </span>
      )}
    </li>
  );
}
