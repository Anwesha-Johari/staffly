"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api, ctx, qs, post, put, fmtMoney2, fmtDate, thisMonth } from "@/lib/api";
import { useSession, isStaff } from "@/lib/session";
import { Avatar, Button, Card, Drawer, EmptyState, ErrorState, Field, Input, PageHeader, Select, StatusBadge, StatCard, Table, TableSkeleton, Td, Th, useFetch, useToast } from "@/components/ui";
import { Wallet, CheckCircle2, Clock } from "lucide-react";

export function PayrollView() {
  const { user } = useSession();
  const toast = useToast();
  const staff = isStaff(user);
  const [month, setMonth] = useState(staff ? thisMonth() : "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ employeeId: "", payMonth: thisMonth(), basic: "", allowances: "0", deductions: "0" });

  const { data, error, loading, reload } = useFetch(
    () => api<{ records: any[] }>(`/api/payroll?${qs({ ...ctx(user!), month })}`), [user?.accountId, month]
  );
  const emps = useFetch(() => staff ? api<{ employees: any[] }>(`/api/employees?${qs({ ...ctx(user!), status: "Active" })}`) : Promise.resolve({ employees: [] }), [user?.accountId]);
  if (!user) return null;

  const rows = data?.records || [];
  const sum = (s?: string) => rows.filter((r) => !s || r.payment_status === s).reduce((a, r) => a + Number(r.net_salary), 0);
  const net = Math.max(0, Number(f.basic || 0) + Number(f.allowances || 0) - Number(f.deductions || 0));
  const invalid = Number(f.deductions) > Number(f.basic || 0) + Number(f.allowances || 0);

  async function generate() {
    if (!f.employeeId) return toast.error("Choose an employee.");
    if (f.basic === "") return toast.error("Enter a basic salary.");
    setBusy(true);
    try {
      await post("/api/payroll", { ...ctx(user!), employeeId: f.employeeId, payMonth: f.payMonth, basicSalary: f.basic, allowances: f.allowances, deductions: f.deductions });
      toast.success("Payroll generated.");
      setOpen(false); reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function setStatus(id: number, status: string) {
    try { await put("/api/payroll", { ...ctx(user!), payrollId: id, status }); toast.success(`Marked as ${status}.`); reload(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <>
      <PageHeader title="Payroll" subtitle={staff ? "Generate payslips and track payment status" : "Your payslips"}
        actions={staff && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Generate payroll</Button>} />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total net" value={fmtMoney2(sum())} icon={<Wallet className="size-5" />} />
        <StatCard label="Paid" value={fmtMoney2(sum("Paid"))} icon={<CheckCircle2 className="size-5" />} tone="ok" />
        <StatCard label="Pending / on hold" value={fmtMoney2(sum("Pending") + sum("On Hold"))} icon={<Clock className="size-5" />} tone="warn" />
      </div>
      <div className="mb-4 flex items-end gap-2 anim-fade-up">
        <Field label="Pay month">{(id) => <Input id={id} type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}</Field>
        {month && <Button variant="ghost" size="sm" onClick={() => setMonth("")}>Show all months</Button>}
      </div>

      <Card className="overflow-hidden anim-fade-up">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <TableSkeleton cols={7} /> : rows.length === 0 ? (
          <EmptyState title="No payroll records" hint={staff ? "Generate payroll to get started." : "No payslips have been issued yet."} />
        ) : (
          <Table>
            <thead><tr>{staff && <Th>Employee</Th>}<Th>Month</Th><Th>Basic</Th><Th>Allowances</Th><Th>Deductions</Th><Th>Net</Th><Th>Status</Th>{staff && <Th className="text-right">Update</Th>}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.payroll_id} className="hover:bg-surface-2/60">
                  {staff && <Td><div className="flex items-center gap-2.5"><Avatar name={r.employee_name} size={28} />{r.employee_name}</div></Td>}
                  <Td className="whitespace-nowrap">{new Date(r.pay_month + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</Td>
                  <Td className="tabular-nums">{fmtMoney2(r.basic_salary)}</Td>
                  <Td className="tabular-nums text-ok">+{fmtMoney2(r.allowances)}</Td>
                  <Td className="tabular-nums text-bad">−{fmtMoney2(r.deductions)}</Td>
                  <Td className="font-semibold tabular-nums">{fmtMoney2(r.net_salary)}</Td>
                  <Td><StatusBadge status={r.payment_status} />{r.payment_date && <p className="mt-1 text-xs text-muted">{fmtDate(r.payment_date)}</p>}</Td>
                  {staff && <Td className="text-right">
                    <Select aria-label="Payment status" value={r.payment_status} onChange={(e) => setStatus(r.payroll_id, e.target.value)} className="h-8 w-28 text-xs">
                      <option>Pending</option><option>Paid</option><option>On Hold</option>
                    </Select>
                  </Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Drawer open={open} onClose={() => setOpen(false)} title="Generate payroll" subtitle="One payslip per employee per month"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={busy} disabled={invalid} onClick={generate}>Generate</Button></>}>
        <div className="space-y-4">
          <Field label="Employee">{(id) => (
            <Select id={id} value={f.employeeId} onChange={(e) => {
              const emp = emps.data?.employees.find((x) => String(x.employee_id) === e.target.value);
              setF({ ...f, employeeId: e.target.value, basic: emp ? String(Math.round((emp.salary / 12) * 100) / 100) : f.basic });
            }}>
              <option value="">Select…</option>
              {emps.data?.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.first_name} {e.last_name}</option>)}
            </Select>
          )}</Field>
          <Field label="Pay month">{(id) => <Input id={id} type="month" value={f.payMonth} onChange={(e) => setF({ ...f, payMonth: e.target.value })} />}</Field>
          <Field label="Basic salary" hint="Prefilled as annual salary ÷ 12">{(id) => <Input id={id} type="number" min="0" step="0.01" value={f.basic} onChange={(e) => setF({ ...f, basic: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Allowances">{(id) => <Input id={id} type="number" min="0" step="0.01" value={f.allowances} onChange={(e) => setF({ ...f, allowances: e.target.value })} />}</Field>
            <Field label="Deductions" error={invalid ? "Exceeds basic + allowances" : undefined}>{(id) => <Input id={id} type="number" min="0" step="0.01" value={f.deductions} onChange={(e) => setF({ ...f, deductions: e.target.value })} />}</Field>
          </div>
          <div className="rounded-xl bg-brand-soft p-4 text-brand">
            <p className="text-xs font-semibold uppercase tracking-wider">Net pay</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtMoney2(net)}</p>
          </div>
        </div>
      </Drawer>
    </>
  );
}
