"use client";

import Link from "next/link";
import { Users, UserCheck, Plane, Wallet, ArrowRight, CalendarCheck, Clock } from "lucide-react";
import { api, ctx, qs, fmtMoney, fmtDate } from "@/lib/api";
import { useSession, isStaff } from "@/lib/session";
import { Badge, Card, EmptyState, ErrorState, PageHeader, StatCard, StatusBadge, useFetch, Avatar } from "@/components/ui";

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export function DashboardView() {
  const { user } = useSession();
  const { data, error, loading, reload } = useFetch(
    () => api<any>(`/api/dashboard?${qs(ctx(user!))}`), [user?.accountId]
  );
  if (!user) return null;
  const first = user.employeeName.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${first}`}
        subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      />
      {error ? <Card><ErrorState message={error} onRetry={reload} /></Card> : loading || !data ? <DashSkeleton /> : isStaff(user) ? <StaffView d={data} /> : <PersonalView d={data} />}
    </>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="skeleton h-72" /><div className="skeleton h-72" /></div>
    </div>
  );
}

function StaffView({ d }: { d: any }) {
  const e = d.employees || {};
  const paid = (d.payrollThisMonth as any[]).reduce((a, r) => a + Number(r.total), 0);
  const maxHead = Math.max(1, ...d.departments.map((x: any) => Number(x.headcount)));
  const attTotal = (d.attendanceToday as any[]).reduce((a, r) => a + Number(r.n), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total employees" value={e.total ?? 0} hint={`${e.inactive ?? 0} inactive`} icon={<Users className="size-5" />} />
        <StatCard label="Active" value={e.active ?? 0} hint={`${e.onLeave ?? 0} on leave`} icon={<UserCheck className="size-5" />} tone="ok" />
        <StatCard label="Pending leave" value={d.pendingLeaveCount} hint="Awaiting review" icon={<Plane className="size-5" />} tone="warn" />
        <StatCard label="Payroll this month" value={fmtMoney(paid)} hint={`Active salary base ${fmtMoney(e.payroll)}`} icon={<Wallet className="size-5" />} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3 anim-fade-up">
          <h2 className="font-semibold">Headcount by department</h2>
          <p className="text-sm text-muted">Active and on-leave employees</p>
          {d.departments.length === 0 ? <EmptyState title="No departments yet" /> : (
            <ul className="mt-5 space-y-3.5">
              {d.departments.map((x: any) => (
                <li key={x.name}>
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{x.name}</span><span className="tabular-nums text-muted">{x.headcount}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${x.name}: ${x.headcount}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-700" style={{ width: `${(Number(x.headcount) / maxHead) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2 anim-fade-up">
          <div className="flex items-center justify-between">
            <div><h2 className="font-semibold">Needs your review</h2><p className="text-sm text-muted">Pending leave requests</p></div>
            <Link href="/leave" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">All <ArrowRight className="size-3.5" /></Link>
          </div>
          {d.pendingLeaves.length === 0 ? <EmptyState title="All caught up" hint="No requests are waiting." /> : (
            <ul className="mt-4 divide-y divide-line">
              {d.pendingLeaves.map((l: any) => (
                <li key={l.leave_id} className="flex items-center gap-3 py-3">
                  <Avatar name={l.employee_name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.employee_name}</p>
                    <p className="truncate text-xs text-muted">{l.leave_type} · {fmtDate(l.start_date)} – {fmtDate(l.end_date)}</p>
                  </div>
                  <Badge tone="warn">Pending</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5 anim-fade-up">
        <div className="flex items-center justify-between">
          <div><h2 className="font-semibold">Today&apos;s attendance</h2><p className="text-sm text-muted">{attTotal} records logged</p></div>
          <Link href="/attendance" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Open <ArrowRight className="size-3.5" /></Link>
        </div>
        {attTotal === 0 ? <p className="mt-4 text-sm text-muted">Nothing recorded yet today.</p> : (
          <div className="mt-4 flex flex-wrap gap-3">
            {(d.attendanceToday as any[]).map((a) => (
              <div key={a.status} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <StatusBadge status={a.status} /><span className="text-xl font-semibold tabular-nums">{a.n}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PersonalView({ d }: { d: any }) {
  const count = (arr: any[], s: string) => Number(arr.find((x) => x.status === s)?.n ?? 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Days present (this month)" value={count(d.attendanceMonth, "Present")} hint={`${count(d.attendanceMonth, "Half Day")} half days`} icon={<CalendarCheck className="size-5" />} tone="ok" />
        <StatCard label="Absences (this month)" value={count(d.attendanceMonth, "Absent")} icon={<Clock className="size-5" />} tone="bad" />
        <StatCard label="Leave pending" value={count(d.leaveSummary, "Pending")} hint={`${count(d.leaveSummary, "Approved")} approved`} icon={<Plane className="size-5" />} tone="warn" />
        <StatCard label="Latest net pay" value={d.latestPayroll ? fmtMoney(d.latestPayroll.net_salary) : "—"} hint={d.latestPayroll ? `${fmtDate(d.latestPayroll.pay_month)} · ${d.latestPayroll.payment_status}` : "No payslips yet"} icon={<Wallet className="size-5" />} tone="info" />
      </div>
      <Card className="p-5 anim-fade-up">
        <h2 className="font-semibold">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["/attendance", "Mark today's attendance", CalendarCheck],
            ["/leave", "Request time off", Plane],
            ["/payroll", "View my payslips", Wallet],
          ].map(([href, label, Icon]: any) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-line p-4 transition-colors hover:border-brand/50 hover:bg-surface-2">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="size-5" /></span>
              <span className="flex-1 text-sm font-medium">{label}</span>
              <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
