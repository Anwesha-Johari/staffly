import Link from "next/link";
import { Suspense } from "react";
import { DbUnavailable, EmptyState, Notice, PageHeader, Pagination, SqlTrace, StatusChip } from "@/components/app";
import { InfoTip } from "@/components/InfoTip";
import { captureSql } from "@/lib/trace";
import {
  leaveCounts,
  listActiveEmployees,
  listLeaveRequests,
  type ActiveEmployee,
  type LeaveCounts,
  type LeaveRow,
} from "@/lib/data/leave";
import { parseLeaveStatusFilter, type LeaveStatus } from "@/lib/validation/leave";
import { ApplyLeaveForm } from "./_components/ApplyLeaveForm";
import { ReviewButtons, ReviewProvider } from "./_components/ReviewControls";

export const metadata = { title: "Leave - Staffly" };

const PAGE_SIZE = 15;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LeavePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Leave"
        description="Apply for time off and review requests. Every request is decided once: Pending, then Approved or Rejected."
      />
      <Suspense fallback={<p className="text-[13px] text-muted">Loading leave requests...</p>}>
        <LeaveContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Loaded =
  | { ok: false; unavailable: boolean; message: string }
  | { ok: true; employees: ActiveEmployee[]; counts: LeaveCounts; rows: LeaveRow[] };

function hrefFor(status: LeaveStatus | null, page = 1): string {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (page > 1) qs.set("page", String(page));
  const text = qs.toString();
  return text ? `/leave?${text}` : "/leave";
}

/** Whole days covered, counting both ends. Both inputs are YYYY-MM-DD. */
function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

async function LeaveContent({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const status = parseLeaveStatusFilter(first(sp.status));
  const requestedPage = Number.parseInt(first(sp.page) ?? "1", 10);
  const wantedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const { result: loaded, sql } = await captureSql<Loaded>(async () => {
    const employees = await listActiveEmployees();
    if (!employees.ok) return { ok: false, unavailable: employees.kind === "unavailable", message: employees.message };
    const counts = await leaveCounts(null);
    if (!counts.ok) return { ok: false, unavailable: counts.kind === "unavailable", message: counts.message };
    const inFilter =
      status === "Pending" ? counts.data.pending
      : status === "Approved" ? counts.data.approved
      : status === "Rejected" ? counts.data.rejected
      : counts.data.total;
    const pageCount = Math.max(1, Math.ceil(inFilter / PAGE_SIZE));
    const page = Math.min(wantedPage, pageCount);
    const rows = await listLeaveRequests({
      employeeId: null,
      status,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    if (!rows.ok) return { ok: false, unavailable: rows.kind === "unavailable", message: rows.message };
    return { ok: true, employees: employees.data, counts: counts.data, rows: rows.data };
  });

  if (!loaded.ok) {
    return loaded.unavailable ? <DbUnavailable /> : <Notice kind="bad">{loaded.message}</Notice>;
  }

  const { counts, rows, employees } = loaded;
  const inFilter =
    status === "Pending" ? counts.pending
    : status === "Approved" ? counts.approved
    : status === "Rejected" ? counts.rejected
    : counts.total;
  const pageCount = Math.max(1, Math.ceil(inFilter / PAGE_SIZE));
  const page = Math.min(wantedPage, pageCount);

  const tabs: Array<{ label: string; value: LeaveStatus | null; count: number }> = [
    { label: "All", value: null, count: counts.total },
    { label: "Pending", value: "Pending", count: counts.pending },
    { label: "Approved", value: "Approved", count: counts.approved },
    { label: "Rejected", value: "Rejected", count: counts.rejected },
  ];

  return (
    <div className="space-y-6">
      <ApplyLeaveForm
        employees={employees.map((e) => ({ employeeId: e.employeeId, name: e.name }))}
        defaultEmployeeId={null}
      />

      <section aria-labelledby="requests-title">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="requests-title" className="text-[17px] font-medium text-ink">
            Requests
          </h2>
          <InfoTip title="Reviewing is a compare-and-set">
            Approve and Reject run <code>UPDATE ... WHERE leave_id = ? AND leave_status = &apos;Pending&apos;</code>. If
            two reviewers click at the same moment, MySQL lets exactly one UPDATE match; the other changes zero rows
            and is told the request was already reviewed. That is how a double review is prevented without locking
            anything in the app. See the{" "}
            <Link href="/under-the-hood#transactions" className="text-accent underline underline-offset-2">
              Transactions tab
            </Link>
            .
          </InfoTip>
        </div>

        <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1 border-b border-line">
          {tabs.map((t) => {
            const current = t.value === status;
            return (
              <Link
                key={t.label}
                href={hrefFor(t.value)}
                aria-current={current ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] ${
                  current ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label} <span className="mono text-[12px] text-faint">{t.count}</span>
              </Link>
            );
          })}
        </nav>

        <ReviewProvider>
          {rows.length === 0 ? (
            <EmptyState
              title={status ? `No ${status.toLowerCase()} requests` : "No leave requests yet"}
              body="Requests appear here as soon as they are submitted."
            />
          ) : (
            <div className="card overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Employee</th>
                    <th scope="col">Type</th>
                    <th scope="col">Dates</th>
                    <th scope="col">Reason</th>
                    <th scope="col">Status</th>
                    <th scope="col">Reviewed</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.leaveId}>
                      <td className="mono text-[12.5px] text-muted">{r.leaveId}</td>
                      <td>{r.employeeName}</td>
                      <td>{r.leaveType}</td>
                      <td className="whitespace-nowrap">
                        <span className="mono text-[12.5px]">
                          {r.startDate} to {r.endDate}
                        </span>
                        <span className="block text-[12px] text-muted">
                          {daysBetween(r.startDate, r.endDate)} day{daysBetween(r.startDate, r.endDate) === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="max-w-[220px] text-muted">{r.reason ?? <span className="text-faint">-</span>}</td>
                      <td>
                        <StatusChip status={r.leaveStatus} />
                      </td>
                      <td className="text-[12.5px] text-muted">
                        {r.reviewerName ? (
                          <>
                            {r.reviewerName}
                            <span className="mono block text-[11.5px] text-faint">{r.reviewedAt}</span>
                          </>
                        ) : (
                          <span className="text-faint">-</span>
                        )}
                      </td>
                      <td>
                        {r.leaveStatus === "Pending" && <ReviewButtons leaveId={r.leaveId} employeeName={r.employeeName} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReviewProvider>

        <Pagination page={page} pageCount={pageCount} makeHref={(p) => hrefFor(status, p)} />
      </section>

      <SqlTrace entries={sql} title="Under the hood: SQL for this page" />
    </div>
  );
}
