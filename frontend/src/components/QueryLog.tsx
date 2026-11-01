"use client";

import { useEffect, useState } from "react";
import type { QueryLogEntry, QueryOperation } from "@/lib/db";
import { InfoTip } from "./InfoTip";

const POLL_MS = 4000;

const OP_CHIP: Record<QueryOperation, string> = {
  SELECT: "chip-info",
  INSERT: "chip-ok",
  UPDATE: "chip-warn",
  DELETE: "chip-bad",
  SCHEMA: "",
  TRANSACTION: "chip-accent",
  OTHER: "",
};

/**
 * Live feed of the statements this dashboard has issued over its pooled
 * MySQL connection (newest first). Polls GET /api/log while mounted.
 */
export function QueryLog() {
  const [entries, setEntries] = useState<QueryLogEntry[] | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch("/api/log", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as QueryLogEntry[];
        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : []);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="card p-4" aria-label="Statement log">
      <header className="mb-3 flex items-center gap-2">
        <h3 className="text-[14px] font-medium text-ink">Statement log</h3>
        <InfoTip title="What is this log?" side="bottom">
          These are the actual SQL statements this dashboard issued over its pooled MySQL connection, newest first,
          with the measured duration and the rows returned or affected. The <code>concept</code> label is inferred
          from the statement text by simple keyword rules (for example a <code>JOIN</code> is tagged as foreign key
          resolution, <code>COUNT(</code> as aggregation), so treat it as a hint rather than a verdict. Only the last
          100 statements are kept in server memory.
        </InfoTip>
        <span className="ml-auto text-[12px] text-faint">
          {entries ? `${entries.length} shown` : "loading"}
          {error && " - log endpoint unreachable"}
        </span>
      </header>

      {entries && entries.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">
          No statements yet. Statements run by this dashboard appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 font-normal">Time</th>
                <th className="py-1.5 pr-3 font-normal">Operation</th>
                <th className="py-1.5 pr-3 font-normal">SQL</th>
                <th className="py-1.5 pr-3 text-right font-normal">ms</th>
                <th className="py-1.5 pr-3 text-right font-normal">Rows</th>
                <th className="py-1.5 pr-3 font-normal">Concept</th>
                <th className="py-1.5 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((e) => {
                const open = expanded.has(e.id);
                return (
                  <tr key={e.id} className="border-b border-line align-top last:border-b-0">
                    <td className="mono whitespace-nowrap py-1.5 pr-3 text-muted">{e.timestamp}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`chip ${OP_CHIP[e.operation] ?? ""}`}>{e.operation}</span>
                    </td>
                    <td className="max-w-[360px] py-1.5 pr-3">
                      <button
                        type="button"
                        onClick={() => toggle(e.id)}
                        aria-expanded={open}
                        title={open ? "Collapse" : "Expand"}
                        className={`mono block w-full text-left text-ink ${
                          open ? "whitespace-pre-wrap break-words" : "truncate"
                        }`}
                      >
                        {e.sql}
                      </button>
                      {open && e.params && e.params.length > 0 && (
                        <div className="mono mt-1 text-faint">params: {JSON.stringify(e.params)}</div>
                      )}
                      {open && e.error && <div className="mt-1 text-bad">{e.error}</div>}
                    </td>
                    <td className="mono whitespace-nowrap py-1.5 pr-3 text-right text-ink">{e.durationMs}</td>
                    <td className="mono whitespace-nowrap py-1.5 pr-3 text-right text-ink">{e.rowCount ?? 0}</td>
                    <td className="py-1.5 pr-3 text-muted">{e.concept}</td>
                    <td className="py-1.5">
                      <span className={`chip ${e.status === "SUCCESS" ? "chip-ok" : "chip-bad"}`}>
                        {e.status === "SUCCESS" ? "ok" : "error"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
