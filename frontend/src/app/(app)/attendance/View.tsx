"use client";

import { useState } from "react";
import { LogIn, LogOut as LogOutIcon, Plus } from "lucide-react";
import { api, ctx, qs, post, fmtDate, today, thisMonth } from "@/lib/api";
import { useSession, isStaff } from "@/lib/session";
import { Avatar, Button, Card, Drawer, EmptyState, ErrorState, Field, Input, PageHeader, Select, StatusBadge, Table, TableSkeleton, Td, Th, useFetch, useToast } from "@/components/ui";

const STATUSES = ["Present", "Half Day", "Absent", "Holiday"];

export function AttendanceView() {
  const { user } = useSession();
  const toast = useToast();
  const staff = isStaff(user);
  const [month, setMonth] = useState(thisMonth());
  const [empFilter, setEmpFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ employeeId: "", date: today(), status: "Present", checkIn: "09:00", checkOut: "" });

  const { data, error, loading, reload } = useFetch(
    () => api<{ records: any[] }>(`/api/attendance?${qs({ ...ctx(user!), month, employeeId: empFilter })}`),
    [user?.accountId, month, empFilter]
  );
  const emps = useFetch(() => staff ? api<{ employees: any[] }>(`/api/employees?${qs({ ...ctx(user!), status: "Active" })}`) : Promise.resolve({ employees: [] }), [user?.accountId]);
  if (!user) return null;

  const records = data?.records || [];
  const summary = STATUSES.map((s) => ({ s, n: records.filter((r) => r.attendance_status === s).length }));
  const targetId = staff ? f.employeeId : String(user.employeeId);

  async function save() {
    if (!targetId) return toast.error("Choose an employee.");
    if (f.checkIn && f.checkOut && f.checkOut < f.checkIn) return toast.error("Check-out cannot be earlier than check-in.");
    setBusy(true);
    try {
      await post("/api/attendance", { ...ctx(user!), employeeId: targetId, attendanceDate: f.date, attendanceStatus: f.status, checkIn: f.status === "Present" || f.status === "Half Day" ? f.checkIn : "", checkOut: f.checkOut });
      toast.success("Attendance recorded.");
      setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Attendance" subtitle={staff ? "Track daily presence across the organisation" : "Your attendance record"}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>{staff ? "Record attendance" : "Mark my attendance"}</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3 anim-fade-up">
        <Field label="Month">{(id) => <Input id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}</Field>
        {staff && <Field label="Employee">{(id) => (
          <Select id={id} value={empFilter} onChange={(e) => setEmpFilter(e.target.value)} className="w-56">
            <option value="">Everyone</option>
            {emps.data?.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</option>)}
          </Select>
        )}</Field>}
        <div className="ml-auto flex flex-wrap gap-2 self-end">
          {summary.map(({ s, n }) => (
            <div key={s} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2"><StatusBadge status={s} /><span className="font-semibold tabular-nums">{n}</span></div>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden anim-fade-up">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <TableSkeleton cols={5} /> : records.length === 0 ? (
          <EmptyState title="No attendance records" hint="Nothing recorded for this period." />
        ) : (
          <Table>
            <thead><tr><Th>Date</Th>{staff && <Th>Employee</Th>}<Th>Check-in</Th><Th>Check-out</Th><Th>Status</Th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.attendance_id} className="hover:bg-surface-2/60">
                  <Td className="whitespace-nowrap font-medium">{fmtDate(r.attendance_date)}</Td>
                  {staff && <Td><div className="flex items-center gap-2.5"><Avatar name={r.employee_name} size={28} />{r.employee_name}</div></Td>}
                  <Td className="tabular-nums text-muted">{r.check_in ? <span className="inline-flex items-center gap-1.5"><LogIn className="size-3.5" />{r.check_in}</span> : "—"}</Td>
                  <Td className="tabular-nums text-muted">{r.check_out ? <span className="inline-flex items-center gap-1.5"><LogOutIcon className="size-3.5" />{r.check_out}</span> : "—"}</Td>
                  <Td><StatusBadge status={r.attendance_status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Record attendance" subtitle="One record per employee per day"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        <div className="space-y-4">
          {staff && <Field label="Employee">{(id) => (
            <Select id={id} value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {emps.data?.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</option>)}
            </Select>
          )}</Field>}
          <Field label="Date">{(id) => <Input id={id} type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />}</Field>
          <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>}</Field>
          {(f.status === "Present" || f.status === "Half Day") && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Check-in">{(id) => <Input id={id} type="time" value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} />}</Field>
              <Field label="Check-out" hint="Optional">{(id) => <Input id={id} type="time" value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} />}</Field>
            </div>
          )}
        </div>
      </Drawer>
    </>
  );
}
