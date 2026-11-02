"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Mail, Phone, UserX, UserCheck, ArrowUpDown } from "lucide-react";
import { api, ctx, qs, post, put, fmtMoney, fmtDate, today } from "@/lib/api";
import { useSession, isStaff } from "@/lib/session";
import {
  Avatar, Button, Card, ConfirmDialog, Drawer, EmptyState, ErrorState, Field, Input, PageHeader, Select,
  StatusBadge, Table, TableSkeleton, Td, Th, Tabs, useDebounced, useFetch, useToast,
} from "@/components/ui";

type Emp = {
  employee_id: number; first_name: string; last_name: string; email: string; phone: string | null; hire_date: string;
  salary: number; department_id: number | null; department_name: string | null; role_id: number | null; role_title: string | null;
  manager_id: number | null; manager_name: string | null; employment_status: string;
};
type SortKey = "name" | "department_name" | "hire_date" | "salary";

export function EmployeesView() {
  const { user } = useSession();
  const toast = useToast();
  const staff = isStaff(user);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Active");
  const [dept, setDept] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [editing, setEditing] = useState<Emp | "new" | null>(null);
  const [confirm, setConfirm] = useState<{ emp: Emp; to: "Active" | "Inactive" } | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search.trim());

  const { data, error, loading, reload } = useFetch(
    () => api<{ employees: Emp[] }>(`/api/employees?${qs({ ...ctx(user!), search: q, status })}`),
    [user?.accountId, q, status]
  );
  const lookups = useFetch(async () => {
    const [d, r, m] = await Promise.all([
      api<{ departments: any[] }>("/api/departments"),
      api<{ roles: any[] }>("/api/job-roles"),
      api<{ employees: Emp[] }>(`/api/employees?${qs({ ...ctx(user!), status: "Active" })}`),
    ]);
    return { departments: d.departments, roles: r.roles, managers: m.employees };
  }, [user?.accountId]);

  const rows = useMemo(() => {
    let list = data?.employees || [];
    if (dept) list = list.filter((e) => String(e.department_id) === dept);
    const val = (e: Emp) => sort.key === "name" ? `${e.first_name} ${e.last_name}`.toLowerCase() : sort.key === "department_name" ? (e.department_name || "").toLowerCase() : sort.key === "salary" ? e.salary : e.hire_date;
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [data, dept, sort]);

  if (!user) return null;
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  const SortTh = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <Th><button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink cursor-pointer">{children}<ArrowUpDown className={`size-3 ${sort.key === k ? "text-brand" : "opacity-40"}`} /></button></Th>
  );

  async function changeStatus() {
    if (!confirm) return;
    setBusy(true);
    try {
      await put("/api/employees", { ...ctx(user!), employeeId: confirm.emp.employee_id, employmentStatus: confirm.to });
      toast.success(`${confirm.emp.first_name} is now ${confirm.to}.`);
      setConfirm(null); reload(); lookups.reload();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title={staff ? "Employees" : "My profile"}
        subtitle={staff ? `${rows.length} ${rows.length === 1 ? "person" : "people"} shown` : "View and update your contact details"}
        actions={staff && <Button icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>Add employee</Button>}
      />

      {staff && (
        <div className="mb-4 flex flex-wrap items-center gap-3 anim-fade-up">
          <div className="relative min-w-60 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input aria-label="Search employees" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or ID…" className="pl-9" />
          </div>
          <Tabs value={status} onChange={setStatus} items={[{ id: "Active", label: "Active" }, { id: "On Leave", label: "On leave" }, { id: "Inactive", label: "Inactive" }, { id: "All", label: "All" }]} />
          <Select aria-label="Filter by department" value={dept} onChange={(e) => setDept(e.target.value)} className="w-48">
            <option value="">All departments</option>
            {lookups.data?.departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
          </Select>
        </div>
      )}

      {!staff && !loading && !error && rows[0] ? (
        <ProfileCard emp={rows[0]} onEdit={() => setEditing(rows[0])} />
      ) : (
      <Card className="overflow-hidden anim-fade-up">
        {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <TableSkeleton cols={6} /> : rows.length === 0 ? (
          <EmptyState title="No employees found" hint={q ? "Try a different search or filter." : "Nothing to show here yet."} />
        ) : (
          <Table>
            <thead><tr>
              <SortTh k="name">Employee</SortTh><SortTh k="department_name">Department</SortTh><Th>Role</Th>
              <SortTh k="hire_date">Hired</SortTh>{staff && <SortTh k="salary">Salary</SortTh>}<Th>Status</Th><Th className="text-right">Actions</Th>
            </tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.employee_id} className="transition-colors hover:bg-surface-2/60">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={`${e.first_name} ${e.last_name}`} />
                      <div className="min-w-0">
                        <p className="font-medium">{e.first_name} {e.last_name} <span className="text-xs font-normal text-muted">#{e.employee_id}</span></p>
                        <p className="truncate text-xs text-muted">{e.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{e.department_name || <span className="text-muted">—</span>}</Td>
                  <Td>{e.role_title || <span className="text-muted">—</span>}</Td>
                  <Td className="whitespace-nowrap text-muted">{fmtDate(e.hire_date)}</Td>
                  {staff && <Td className="tabular-nums">{fmtMoney(e.salary)}</Td>}
                  <Td><StatusBadge status={e.employment_status} /></Td>
                  <Td className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(e)} aria-label={`Edit ${e.first_name}`}>{staff ? "Edit" : "Update"}</Button>
                      {staff && (e.employment_status === "Inactive"
                        ? <Button size="sm" variant="success" icon={<UserCheck className="size-3.5" />} onClick={() => setConfirm({ emp: e, to: "Active" })}>Reactivate</Button>
                        : e.employee_id !== user.employeeId && <Button size="sm" variant="danger" icon={<UserX className="size-3.5" />} onClick={() => setConfirm({ emp: e, to: "Inactive" })}>Deactivate</Button>)}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      )}

      {editing && (
        <EmployeeDrawer
          key={editing === "new" ? "new" : editing.employee_id}
          emp={editing === "new" ? null : editing}
          lookups={lookups.data}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); lookups.reload(); }}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.to === "Inactive"}
        loading={busy}
        title={confirm?.to === "Inactive" ? "Deactivate employee?" : "Reactivate employee?"}
        message={confirm ? (confirm.to === "Inactive" ? `${confirm.emp.first_name} ${confirm.emp.last_name} will be marked Inactive and hidden from the default list. Their records are kept.` : `${confirm.emp.first_name} ${confirm.emp.last_name} will be set back to Active.`) : ""}
        confirmLabel={confirm?.to === "Inactive" ? "Deactivate" : "Reactivate"}
        onConfirm={changeStatus}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function ProfileCard({ emp, onEdit }: { emp: Emp; onEdit: () => void }) {
  const name = `${emp.first_name} ${emp.last_name}`;
  const rows: [string, React.ReactNode][] = [
    ["Employee ID", `#${emp.employee_id}`], ["Department", emp.department_name || "—"], ["Job role", emp.role_title || "—"],
    ["Manager", emp.manager_name || "—"], ["Hired", fmtDate(emp.hire_date)], ["Email", emp.email], ["Phone", emp.phone || "—"],
  ];
  return (
    <Card className="overflow-hidden anim-fade-up">
      <div className="flex flex-wrap items-center gap-4 border-b border-line bg-gradient-to-r from-brand-soft to-transparent p-6">
        <Avatar name={name} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{name}</h2>
          <p className="text-sm text-muted">{emp.role_title || "Team member"}</p>
        </div>
        <StatusBadge status={emp.employment_status} />
        <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={onEdit}>Update contact details</Button>
      </div>
      <dl className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k}><dt className="text-xs font-semibold uppercase tracking-wider text-muted">{k}</dt><dd className="mt-1 break-words">{v}</dd></div>
        ))}
      </dl>
    </Card>
  );
}

function EmployeeDrawer({ emp, lookups, onClose, onSaved }: {
  emp: Emp | null; lookups: { departments: any[]; roles: any[]; managers: Emp[] } | null; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useSession();
  const toast = useToast();
  const staff = isStaff(user);
  const isNew = !emp;
  const selfOnly = !staff;
  const [f, setF] = useState({
    firstName: emp?.first_name || "", lastName: emp?.last_name || "", email: emp?.email || "", phone: emp?.phone || "",
    hireDate: emp?.hire_date || today(), salary: emp ? String(emp.salary) : "",
    departmentId: emp?.department_id ? String(emp.department_id) : "", roleId: emp?.role_id ? String(emp.role_id) : "",
    managerId: emp?.manager_id ? String(emp.manager_id) : "", employmentStatus: emp?.employment_status || "Active",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function validate() {
    const x: Record<string, string> = {};
    if (isNew) {
      if (!f.firstName.trim()) x.firstName = "Required";
      if (!f.lastName.trim()) x.lastName = "Required";
      if (f.salary === "" || Number(f.salary) < 0 || isNaN(Number(f.salary))) x.salary = "Enter a non-negative number";
    }
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) x.email = "Enter a valid email";
    if (f.phone && !/^[0-9+()\-\s]{6,20}$/.test(f.phone)) x.phone = "Enter a valid phone number";
    setErrs(x);
    return Object.keys(x).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      if (isNew) {
        await post("/api/employees", { ...ctx(user!), ...f });
        toast.success(`${f.firstName} ${f.lastName} added.`);
      } else if (selfOnly) {
        await put("/api/employees", { ...ctx(user!), employeeId: emp!.employee_id, email: f.email, phone: f.phone });
        toast.success("Contact details updated.");
      } else {
        await put("/api/employees", { ...ctx(user!), employeeId: emp!.employee_id, email: f.email, phone: f.phone, salary: f.salary, departmentId: f.departmentId, roleId: f.roleId, managerId: f.managerId, employmentStatus: f.employmentStatus });
        toast.success("Employee updated.");
      }
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Drawer open onClose={onClose} title={isNew ? "Add employee" : selfOnly ? "Update contact details" : `Edit ${emp!.first_name} ${emp!.last_name}`}
      subtitle={isNew ? "Create a new employee record" : `Employee #${emp!.employee_id}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{isNew ? "Add employee" : "Save changes"}</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4" noValidate>
        {isNew && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" error={errs.firstName}>{(id) => <Input id={id} value={f.firstName} onChange={set("firstName")} autoFocus />}</Field>
            <Field label="Last name" error={errs.lastName}>{(id) => <Input id={id} value={f.lastName} onChange={set("lastName")} />}</Field>
          </div>
        )}
        <Field label="Email" error={errs.email}>{(id) => <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input id={id} type="email" value={f.email} onChange={set("email")} className="pl-9" /></div>}</Field>
        <Field label="Phone" error={errs.phone}>{(id) => <div className="relative"><Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><Input id={id} value={f.phone} onChange={set("phone")} className="pl-9" /></div>}</Field>
        {!selfOnly && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Salary (USD)" error={errs.salary}>{(id) => <Input id={id} type="number" min="0" step="0.01" value={f.salary} onChange={set("salary")} />}</Field>
              {isNew
                ? <Field label="Hire date">{(id) => <Input id={id} type="date" value={f.hireDate} onChange={set("hireDate")} />}</Field>
                : <Field label="Status">{(id) => <Select id={id} value={f.employmentStatus} onChange={set("employmentStatus")}><option>Active</option><option>On Leave</option><option>Inactive</option></Select>}</Field>}
            </div>
            <Field label="Department">{(id) => <Select id={id} value={f.departmentId} onChange={set("departmentId")}><option value="">None</option>{lookups?.departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}</Select>}</Field>
            <Field label="Job role" hint={(() => { const r = lookups?.roles.find((r) => String(r.role_id) === f.roleId); return r && r.min_salary != null ? `Typical range ${fmtMoney(r.min_salary)} – ${fmtMoney(r.max_salary)}` : undefined; })()}>
              {(id) => <Select id={id} value={f.roleId} onChange={set("roleId")}><option value="">None</option>{lookups?.roles.map((r) => <option key={r.role_id} value={r.role_id}>{r.role_title}</option>)}</Select>}
            </Field>
            <Field label="Manager">{(id) => <Select id={id} value={f.managerId} onChange={set("managerId")}><option value="">None</option>{lookups?.managers.filter((m) => m.employee_id !== emp?.employee_id).map((m) => <option key={m.employee_id} value={m.employee_id}>{m.first_name} {m.last_name}</option>)}</Select>}</Field>
          </>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Drawer>
  );
}
