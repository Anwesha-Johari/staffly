"use client";

import { useState } from "react";
import { Play, Trash2, KeyRound, RefreshCw, AlertTriangle } from "lucide-react";
import { api, post } from "@/lib/api";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, StatCard, Table, TableSkeleton, Td, Th, Tabs, Textarea, useFetch, useToast, cx } from "@/components/ui";
import { Database, Table2, Link2, HardDrive } from "lucide-react";

type Tab = "overview" | "schema" | "console" | "logs";

export function DatabaseView() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <>
      <PageHeader title="Database" subtitle="Inspect the schema, run queries and review activity (Admin only)" />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} items={[{ id: "overview", label: "Overview" }, { id: "schema", label: "Schema" }, { id: "console", label: "SQL console" }, { id: "logs", label: "Query log" }]} /></div>
      {tab === "overview" && <Overview />}
      {tab === "schema" && <Schema />}
      {tab === "console" && <Console />}
      {tab === "logs" && <Logs />}
    </>
  );
}

function Overview() {
  const { data, error, loading, reload } = useFetch(() => api<any>("/api/db/stats"), []);
  if (error) return <Card><ErrorState message={error} onRetry={reload} /></Card>;
  if (loading || !data) return <Card><TableSkeleton rows={7} cols={4} /></Card>;
  const totalKb = (data.tables as any[]).reduce((a, t) => a + Number(t.sizeKb), 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Database" value={<span className="text-2xl">{data.database}</span>} hint={`MySQL ${data.version}`} icon={<Database className="size-5" />} />
        <StatCard label="Tables" value={data.tables.length} icon={<Table2 className="size-5" />} tone="info" />
        <StatCard label="Foreign keys" value={data.foreignKeysCount} icon={<Link2 className="size-5" />} tone="ok" />
        <StatCard label="Storage" value={`${totalKb.toFixed(0)} KB`} icon={<HardDrive className="size-5" />} tone="warn" />
      </div>
      <Card className="overflow-hidden">
        <Table>
          <thead><tr><Th>Table</Th><Th>Rows</Th><Th>Size</Th><Th>Engine</Th><Th>Next ID</Th></tr></thead>
          <tbody>
            {(data.tables as any[]).map((t) => (
              <tr key={t.tableName} className="hover:bg-surface-2/60">
                <Td className="font-mono font-medium">{t.tableName}</Td>
                <Td className="tabular-nums">{data.counts[t.tableName] ?? t.estRows}</Td>
                <Td className="tabular-nums text-muted">{t.sizeKb} KB</Td>
                <Td><Badge tone="neutral" dot={false}>{t.engine}</Badge></Td>
                <Td className="tabular-nums text-muted">{t.nextAutoIncrement ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">Relationships</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {(data.foreignKeys as any[]).map((fk) => (
            <li key={fk.CONSTRAINT_NAME} className="flex items-center gap-2 rounded-lg bg-surface-2/60 px-3 py-2 font-mono text-xs">
              <span>{fk.TABLE_NAME}.{fk.COLUMN_NAME}</span><span className="text-muted">→</span><span className="text-brand">{fk.REFERENCED_TABLE_NAME}.{fk.REFERENCED_COLUMN_NAME}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Schema() {
  const { data, error, loading, reload } = useFetch(() => api<any>("/api/db/schema"), []);
  if (error) return <Card><ErrorState message={error} onRetry={reload} /></Card>;
  if (loading || !data) return <Card><TableSkeleton rows={8} cols={4} /></Card>;
  const schema = data.schema || data.tables || data;
  const entries: [string, any][] = Object.entries(schema).filter(([, v]: any) => v && (v.columns || Array.isArray(v)));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {entries.map(([name, v]: any) => {
        const cols: any[] = v.columns || v;
        return (
          <Card key={name} className="overflow-hidden">
            <div className="border-b border-line px-5 py-3 font-mono font-semibold">{name}</div>
            <Table>
              <tbody>
                {cols.map((c) => (
                  <tr key={c.name}>
                    <Td className="font-mono text-xs">
                      <span className="inline-flex items-center gap-1.5">{c.columnKey === "PRI" && <KeyRound className="size-3 text-warn" />}{c.name}</span>
                    </Td>
                    <Td className="font-mono text-xs text-muted">{c.type}</Td>
                    <Td className="text-xs">
                      {c.columnKey === "UNI" && <Badge tone="info" dot={false}>unique</Badge>} {c.columnKey === "MUL" && <Badge tone="neutral" dot={false}>fk</Badge>} {c.isNullable === "NO" && <Badge tone="neutral" dot={false}>required</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        );
      })}
    </div>
  );
}

const EXAMPLES = [
  "SELECT d.department_name, COUNT(*) AS headcount\nFROM employees e JOIN departments d ON e.department_id = d.department_id\nGROUP BY d.department_name;",
  "SELECT * FROM leave_requests WHERE leave_status = 'Pending';",
  "SHOW TABLES;",
];

function Console() {
  const toast = useToast();
  const [sql, setSql] = useState(EXAMPLES[0]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const risky = /\b(DROP|TRUNCATE|DELETE|UPDATE|ALTER|INSERT)\b/i.test(sql);

  async function run() {
    if (!sql.trim()) return;
    setBusy(true); setErr(null);
    try { setRes(await post("/api/db/execute-sql", { sql })); }
    catch (e: any) { setRes(null); setErr(e.message); toast.error("Query failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Textarea aria-label="SQL" value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }} className="min-h-36 font-mono text-[13px]" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button icon={<Play className="size-4" />} loading={busy} onClick={run}>Run query</Button>
          <span className="text-xs text-muted">Ctrl/⌘ + Enter</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {["Group by", "Pending leave", "Show tables"].map((l, i) => <Button key={l} size="sm" variant="ghost" onClick={() => setSql(EXAMPLES[i])}>{l}</Button>)}
          </div>
        </div>
        {risky && <p className="mt-3 flex items-center gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn"><AlertTriangle className="size-4 shrink-0" />This statement can modify data. It runs immediately against the live database.</p>}
      </Card>
      {err && <Card className="border-bad/40 bg-bad-soft p-4 font-mono text-sm text-bad">{err}</Card>}
      {res && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm">
            <span><b>{res.rowCount}</b> {res.resultHeader ? "rows affected" : "rows"}</span><span className="text-muted">{res.durationMs} ms</span>
          </div>
          {res.columns?.length ? (
            <div className="max-h-96 overflow-auto">
              <Table>
                <thead><tr>{res.columns.map((c: string) => <Th key={c}>{c}</Th>)}</tr></thead>
                <tbody>{res.rows.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-surface-2/60">{res.columns.map((c: string) => <Td key={c} className="font-mono text-xs">{r[c] === null ? <span className="text-muted">NULL</span> : String(r[c])}</Td>)}</tr>
                ))}</tbody>
              </Table>
            </div>
          ) : <p className="p-5 text-sm text-muted">Statement executed successfully.</p>}
        </Card>
      )}
    </div>
  );
}

function Logs() {
  const toast = useToast();
  const { data, error, loading, reload } = useFetch(() => api<{ logs: any[] }>("/api/db/query-logs"), []);
  async function clear() { await api("/api/db/query-logs", { method: "DELETE" }); toast.success("Query log cleared."); reload(); }
  const logs = data?.logs || [];
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-sm text-muted">{logs.length} recent queries</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} onClick={reload}>Refresh</Button>
          <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={clear} disabled={!logs.length}>Clear</Button>
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading ? <TableSkeleton cols={4} /> : logs.length === 0 ? <EmptyState title="No queries logged yet" /> : (
        <ul className="divide-y divide-line">
          {logs.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={l.status === "SUCCESS" ? "ok" : "bad"}>{l.operation}</Badge>
                <span className="text-muted">{l.timestamp}</span><span className="tabular-nums text-muted">{l.durationMs} ms</span><span className="text-muted">· {l.rowCount} rows</span>
                <span className={cx("ml-auto", "text-brand")}>{l.concept}</span>
              </div>
              <code className="mt-1.5 block break-all font-mono text-xs text-ink/80">{l.sql}</code>
              {l.error && <p className="mt-1 text-xs text-bad">{l.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
