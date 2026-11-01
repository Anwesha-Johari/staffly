import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DbUnavailable, EmptyState, Notice, PageHeader, SqlTrace, StatusChip } from "@/components/app";
import { InfoTip } from "@/components/InfoTip";
import { captureSql } from "@/lib/trace";
import {
  getEmployeeName,
  listDailyAttendance,
  listEmployeeMonth,
  listEmployeeOptions,
  monthlySummary,
  type AttendanceDay,
  type DailyRow,
  type EmployeeName,
  type EmployeeOption,
  type MonthlySummary,
} from "@/lib/data/attendance";
import { parseId, parseIsoDate, parseMonth, todayIso, type MonthRange } from "@/lib/validation/attendance";
import { MarkAttendanceForm } from "./_components/MarkAttendanceForm";
import { MonthGrid } from "./_components/MonthGrid";

export const metadata = { title: "Attendance - Staffly" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function AttendancePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Attendance"
        description="One row per employee per day. Review a month at a glance, or check who is in on a given date."
      />
      <Suspense fallback={<p className="text-[13px] text-muted">Loading attendance...</p>}>
        <AttendanceContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Loaded =
  | { ok: false; unavailable: boolean; message: string }
  | {
      ok: true;
      employees: EmployeeOption[];
      targetId: number;
      target: EmployeeName | null;
      days: AttendanceDay[];
      summary: MonthlySummary | null;
      daily: DailyRow[];
    };

async function AttendanceContent({ searchParams }: { searchParams: SearchParams }) {
  // "Today" depends on the request time, so this must never be prerendered.
  await connection();
  const sp = await searchParams;

  const view: "month" | "day" = first(sp.view) === "day" ? "day" : "month";
  const today = todayIso();

  const requestedMonth = first(sp.month);
  const parsedMonth = parseMonth(requestedMonth);
  const month: MonthRange = parsedMonth ?? (parseMonth(today.slice(0, 7)) as MonthRange);
  const monthWasInvalid = requestedMonth !== undefined && requestedMonth !== "" && parsedMonth === null;

  const requestedDate = first(sp.date);
  const date = parseIsoDate(requestedDate) ?? today;
  const dateWasInvalid = requestedDate !== undefined && requestedDate !== "" && parseIsoDate(requestedDate) === null;

  // null until the employee list is loaded; then defaults to the first employee.
  const requestedEmployee = parseId(first(sp.employee));

  const { result: loaded, sql } = await captureSql<Loaded>(async () => {
    const empty = { employees: [] as EmployeeOption[], targetId: 0, target: null, days: [], summary: null, daily: [] };
    const list = await listEmployeeOptions(false);
    if (!list.ok) return { ok: false, unavailable: list.kind === "unavailable", message: list.message };
    const employees = list.data;
    const targetId = requestedEmployee ?? employees[0]?.employeeId ?? 0;
    if (view === "day") {
      const daily = await listDailyAttendance(date);
      if (!daily.ok) return { ok: false, unavailable: daily.kind === "unavailable", message: daily.message };
      return { ok: true, ...empty, employees, targetId, daily: daily.data };
    }
    const target = await getEmployeeName(targetId);
    if (!target.ok) return { ok: false, unavailable: target.kind === "unavailable", message: target.message };
    if (!target.data) return { ok: true, ...empty, employees, targetId };
    const days = await listEmployeeMonth(targetId, month);
    if (!days.ok) return { ok: false, unavailable: days.kind === "unavailable", message: days.message };
    const summary = await monthlySummary(targetId, month);
    if (!summary.ok) return { ok: false, unavailable: summary.kind === "unavailable", message: summary.message };
    return { ok: true, ...empty, employees, targetId, target: target.data, days: days.data, summary: summary.data };
  });

  if (!loaded.ok) {
    return loaded.unavailable ? <DbUnavailable /> : <Notice kind="bad">{loaded.message}</Notice>;
  }

  const activeEmployees = loaded.employees
    .filter((e) => e.status === "Active")
    .map((e) => ({ employeeId: e.employeeId, name: e.name }));
  const defaultEmployeeId =
    loaded.target && activeEmployees.some((e) => e.employeeId === loaded.target?.employeeId)
      ? loaded.target.employeeId
      : (activeEmployees[0]?.employeeId ?? null);

  return (
    <div className="space-y-6">
      <MarkAttendanceForm
        employees={activeEmployees}
        defaultEmployeeId={defaultEmployeeId}
        defaultDate={view === "day" ? date : today}
      />

      <nav aria-label="Attendance views" className="flex gap-1 border-b border-line">
        <ViewLink href={`/attendance?employee=${loaded.targetId}&month=${month.key}`} current={view === "month"}>
          Month
        </ViewLink>
        <ViewLink href={`/attendance?view=day&date=${date}`} current={view === "day"}>
          Daily
        </ViewLink>
      </nav>

      {view === "month" ? (
        <MonthView
          employees={loaded.employees}
          targetId={loaded.targetId}
          month={month}
          monthWasInvalid={monthWasInvalid}
          target={loaded.target}
          days={loaded.days}
          summary={loaded.summary}
        />
      ) : (
        <DayView date={date} dateWasInvalid={dateWasInvalid} rows={loaded.daily} />
      )}

      <SqlTrace entries={sql} title="Under the hood: SQL for this page" />
    </div>
  );
}

function ViewLink({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] ${
        current ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ month */

function MonthView({
  employees,
  targetId,
  month,
  monthWasInvalid,
  target,
  days,
  summary,
}: {
  employees: EmployeeOption[];
  targetId: number;
  month: MonthRange;
  monthWasInvalid: boolean;
  target: EmployeeName | null;
  days: AttendanceDay[];
  summary: MonthlySummary | null;
}) {
  return (
    <section aria-labelledby="month-title" className="space-y-5">
      <form method="get" action="/attendance" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
            <label htmlFor="f-employee" className="field-label">
              Employee
            </label>
            <select id="f-employee" name="employee" className="field" defaultValue={String(targetId)}>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                  {e.status !== "Active" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>
        <div>
          <label htmlFor="f-month" className="field-label">
            Month
          </label>
          <input
            id="f-month"
            name="month"
            type="month"
            className="field"
            defaultValue={month.key}
            pattern="\d{4}-\d{2}"
          />
        </div>
        <button type="submit" className="btn">
          Show month
        </button>
      </form>

      {monthWasInvalid && <Notice kind="warn">That month was not recognised, so {month.label} is shown instead.</Notice>}

      {!target || !summary ? (
        <EmptyState title="Employee not found" body="There is no employee with that ID. Choose someone from the list." />
      ) : (
        <>
          <div>
            <h2 id="month-title" className="text-[20px] font-medium text-ink">
              {target.name}
              <span className="ml-2 text-muted">{month.label}</span>
            </h2>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center gap-1.5">
              <h3 className="text-[15px] font-medium text-ink">Monthly summary</h3>
              <InfoTip title="How the summary is computed">
                One aggregate query: <code>COUNT(*)</code> and <code>SUM(attendance_status = &apos;Present&apos;)</code>{" "}
                (and the other statuses) over <code>attendance_date &gt;= first day AND attendance_date &lt; first day
                of next month</code>. A half-open range matches every time of day on the last date, and it starts
                with the unique key (employee_id, attendance_date), so MySQL reads only this employee&apos;s rows for
                the month.
              </InfoTip>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Days recorded" value={summary.totalDaysRecorded} />
              <Stat label="Present" value={summary.presentDays} />
              <Stat label="Absent" value={summary.absentDays} />
              <Stat label="Half days" value={summary.halfDays} />
              <Stat label="Holidays" value={summary.holidays} />
            </dl>
          </div>

          <div className="card p-5">
            <MonthGrid month={month} days={days} />
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-flat px-3.5 py-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="num-serif mt-0.5 text-[26px] leading-none text-ink">{value}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------- day */

function DayView({ date, dateWasInvalid, rows }: { date: string; dateWasInvalid: boolean; rows: DailyRow[] }) {
  const recorded = rows.filter((r) => r.status !== null).length;
  const missing = rows.length - recorded;

  return (
    <section aria-labelledby="day-title" className="space-y-5">
      <form method="get" action="/attendance" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="view" value="day" />
        <div>
          <label htmlFor="f-date" className="field-label">
            Date
          </label>
          <input id="f-date" name="date" type="date" className="field" defaultValue={date} />
        </div>
        <button type="submit" className="btn">
          Show day
        </button>
      </form>

      {dateWasInvalid && <Notice kind="warn">That date was not recognised, so {date} is shown instead.</Notice>}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="day-title" className="text-[20px] font-medium text-ink">
          {date}
        </h2>
        <p className="inline-flex items-center gap-1.5 text-[13px] text-muted">
          {recorded} recorded, {missing} not recorded yet
          <InfoTip title="Not recorded">
            The list is a <code>LEFT JOIN</code> from employees to that day&apos;s attendance rows, so an active
            employee with no row still appears (status NULL) instead of silently disappearing.
          </InfoTip>
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No employees to show" body="There are no active employees and no attendance rows for this date." />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Status</th>
                <th scope="col">Check-in</th>
                <th scope="col">Check-out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeId}>
                  <td>
                    <Link
                      href={`/attendance?employee=${r.employeeId}&month=${date.slice(0, 7)}`}
                      className="text-ink underline-offset-2 hover:text-accent hover:underline"
                    >
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.status ? <StatusChip status={r.status} /> : <span className="text-faint">Not recorded</span>}</td>
                  <td className="mono text-[12.5px]">{r.checkIn ? r.checkIn.slice(0, 5) : <span className="text-faint">-</span>}</td>
                  <td className="mono text-[12.5px]">{r.checkOut ? r.checkOut.slice(0, 5) : <span className="text-faint">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
