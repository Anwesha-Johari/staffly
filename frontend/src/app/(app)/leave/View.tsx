"use client";

import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { api, ctx, qs, post, put, fmtDate, today } from "@/lib/api";
import { useSession, isStaff } from "@/lib/session";
import { Avatar, Button, Card, Drawer, EmptyState, ErrorState, Field, Input, PageHeader, Select, StatusBadge, Table, TableSkeleton, Td, Th, Tabs, Textarea, useFetch, useToast } from "@/components/ui";

const TYPES = ["Annual Leave", "Sick Leave", "Casual Leave", "Maternity/Paternity", "Unpaid Leave"];

export function LeaveView() {
  const { user } = useSession();
  const toast = useToast();
  const staff = isStaff(user);
  const [tab, setTab] = useState(staff ? "Pending" : "All");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [f, setF] = useState({ leaveType: TYPES[0], startDate: today(), endDate: today(), reason: "" });

  const { data, error, loading, reload } = useFetch(
    () => api<{ requests: any[] }>(`/api/leave?${qs({ ...ctx(user!), status: tab })}`), [user?.accountId, tab]
  );
  if (!user) return null;
  const rows = data?.requests || [];
  const days = Math.max(0, Math.round((+new Date(f.endDate) - +new Date(f.startDate)) / 86400000) + 1);

  async function apply() {
    if (f.endDate < f.startDate) return toast.error("End date cannot be before start date.");
    setBusy(true);
    try {
      await post("/api/leave", { ...ctx(user!), ...f });
      toast.success("Leave request submitted.");
      setOpen(false); setF({ ...f, reason: "" }); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function review(id: number, decision: "Approved" | "Rejected") {
    setActing(id);
    try { await put("/api/leave", { ...ctx(user!), leaveId: id, decision }); toast.success(`Request ${decision.toLowerCase()}.`); reload(); }
    catch (e: any) { toast.error(e.message); } finally { setActing(null); }
  }

  return (
    <>
      <PageHeader title="Leave" subtitle={staff ? "Review and manage time-off requests" : "Your time-off requests"}
        actions={<Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Request leave</Button>} />
      <div className="mb-4 anim-fade-up">
        <Tabs value={tab} onChange={setTab} items={[{ id: "Pending", label: "Pending" }, { id: "Approved", label: "Approved" }, { id: "Rejected", label: "Rejected" }, { id: "All", label: "All" }]} />
      </div>

      <Card className="overflow-hidden anim-fade-up">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <TableSkeleton cols={5} /> : rows.length === 0 ? (
          <EmptyState title={tab === "Pending" ? "No pending requests" : "No leave requests"} hint="Requests will appear here." />
        ) : (
          <Table>
            <thead><tr>{staff && <Th>Employee</Th>}<Th>Type</Th><Th>Dates</Th><Th>Days</Th><Th>Reason</Th><Th>Status</Th>{staff && <Th className="text-right">Decision</Th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.leave_id} className="hover:bg-surface-2/60">
                  {staff && <Td><div className="flex items-center gap-2.5"><Avatar name={r.employee_name} size={28} />{r.employee_name}</div></Td>}
                  <Td className="font-medium whitespace-nowrap">{r.leave_type}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDate(r.start_date)} – {fmtDate(r.end_date)}</Td>
                  <Td className="tabular-nums">{r.days}</Td>
                  <Td className="max-w-56 truncate text-muted" >{r.reason || "—"}</Td>
                  <Td><StatusBadge status={r.leave_status} />{r.reviewer_name && <p className="mt-1 text-xs text-muted">by {r.reviewer_name}</p>}</Td>
                  {staff && <Td className="text-right">
                    {r.leave_status === "Pending" ? (
                      <div className="inline-flex gap-1.5">
                        <Button size="sm" variant="success" loading={acting === r.leave_id} icon={<Check className="size-3.5" />} onClick={() => review(r.leave_id, "Approved")}>Approve</Button>
                        <Button size="sm" variant="danger" disabled={acting === r.leave_id} icon={<X className="size-3.5" />} onClick={() => review(r.leave_id, "Rejected")}>Reject</Button>
                      </div>
                    ) : <span className="text-xs text-muted">Reviewed</span>}
                  </Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Request leave" subtitle="Your manager or HR will review it"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} onClick={apply}>Submit request</Button></>}>
        <div className="space-y-4">
          <Field label="Leave type">{(id) => <Select id={id} value={f.leaveType} onChange={(e) => setF({ ...f, leaveType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">{(id) => <Input id={id} type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate })} />}</Field>
            <Field label="To">{(id) => <Input id={id} type="date" min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />}</Field>
          </div>
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{days} {days === 1 ? "day" : "days"} requested</p>
          <Field label="Reason" hint="Optional, up to 255 characters">{(id) => <Textarea id={id} maxLength={255} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />}</Field>
        </div>
      </Drawer>
    </>
  );
}
