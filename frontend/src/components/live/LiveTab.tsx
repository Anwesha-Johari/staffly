"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LIBRARY } from "@/lib/library";
import { readStatement } from "@/lib/explainStatement";
import type { TabProps } from "@/lib/types";
import { Explainer } from "../Explainer";
import { InfoTip } from "../InfoTip";
import { SqlView } from "../SqlView";

interface Entry {
  id: string;
  timestamp: string;
  sql: string;
  params?: unknown[];
  durationMs: number;
  rowCount?: number;
  operation: string;
  concept: string;
  status: "SUCCESS" | "ERROR";
  error?: string;
}

type Filter = "all" | "reads" | "writes" | "errors";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "reads", label: "Reads" },
  { id: "writes", label: "Writes" },
  { id: "errors", label: "Errors" },
];

const OP_CHIP: Record<string, string> = {
  SELECT: "chip-info",
  INSERT: "chip-ok",
  UPDATE: "chip-warn",
  DELETE: "chip-bad",
  TRANSACTION: "chip-accent",
};

export function LiveTab({ schema, live, nav }: TabProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [showTour, setShowTour] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastKey = useRef("");
  const tableNames = useMemo(() => schema.tables.map((t) => t.name), [schema]);

  useEffect(() => {
    if (paused || !live?.connected) return;
    let cancelled = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/log", { cache: "no-store" });
        const data = (await res.json()) as Entry[];
        if (cancelled || !Array.isArray(data)) return;
        const key = data.length + ":" + (data[0]?.id ?? "");
        if (key !== lastKey.current) {
          lastKey.current = key;
          setEntries(data);
        }
      } catch {
        /* keep the last list */
      }
    };
    tick();
    const t = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [paused, live?.connected]);

  const readings = useMemo(
    () => new Map(entries.map((e) => [e.id, readStatement(e.sql, e.operation, e.concept, tableNames)])),
    [entries, tableNames],
  );

  const visible = entries.filter((e) => {
    if (!showTour && readings.get(e.id)?.fromTour) return false;
    if (filter === "reads") return e.operation === "SELECT";
    if (filter === "writes") return e.operation === "INSERT" || e.operation === "UPDATE" || e.operation === "DELETE";
    if (filter === "errors") return e.status === "ERROR";
    return true;
  });

  const selected = visible.find((e) => e.id === selectedId) ?? visible[0] ?? null;
  const reading = selected ? readings.get(selected.id) : undefined;

  const clear = async () => {
    try {
      await fetch("/api/log", { method: "DELETE", headers: { Origin: window.location.origin } });
    } catch {
      /* ignore */
    }
    lastKey.current = "";
    setEntries([]);
    setSelectedId(null);
  };

  const stats = useMemo(() => {
    const own = entries.filter((e) => !readings.get(e.id)?.fromTour);
    const total = own.reduce((n, e) => n + e.durationMs, 0);
    return { count: own.length, avg: own.length ? total / own.length : 0, max: own.reduce((m, e) => Math.max(m, e.durationMs), 0) };
  }, [entries, readings]);

  // Closest library lesson for the selected statement: most tables in common, same operation.
  const operation = selected?.operation ?? "";
  const tablesKey = reading?.tables.join(",") ?? "";
  const related = (() => {
    const tables = tablesKey ? tablesKey.split(",") : [];
    if (!operation || tables.length === 0) return null;
    let best: { id: string; title: string; score: number } | null = null;
    for (const q of LIBRARY) {
      if (!new RegExp(`^\\s*${operation}\\b`, "i").test(q.sql)) continue;
      const score = q.tables.filter((t) => tables.includes(t)).length * 2 - Math.abs(q.tables.length - tables.length);
      if (score > 0 && (!best || score > best.score)) best = { id: q.id, title: q.title, score };
    }
    return best;
  })();

  if (!live?.connected) {
    return (
      <div className="space-y-6">
        <Explainer title="Live activity: watch the engine work">
          This tab lists the SQL statements the employee dashboard really sends to MySQL while you use it. It needs a running
          database, and none is connected right now.
        </Explainer>
        <div className="card p-5 text-[13.5px] text-muted">
          Start the local database with <code className="mono text-ink">scripts/dev-db.sh start</code> (see the README), then
          reload this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Explainer
        title="Live activity: watch the engine work"
        steps={[
          "Open the employee dashboard in a new tab.",
          "Click around: search, add, approve.",
          "Come back: each click became SQL.",
          "Select a statement to read what it did.",
        ]}
        tryThis="Search for a name on the Employees page, then select the new SELECT here."
      >
        Every button in the employee dashboard turns into SQL that MySQL runs. This list shows those statements as they happen,
        newest first, with how long each took. The dashboard keeps one pool of up to 10 database connections and reuses them.
      </Explainer>

      <section className="card p-5" aria-labelledby="feed-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="feed-h" className="flex items-center gap-2 text-[16px] font-medium text-ink">
            Statements
            <InfoTip title="Where this list comes from">
              The dashboard remembers its last 100 statements in memory and this tab asks for them every 2 seconds. Passwords are
              never included. Housekeeping queries from this tour (row counts, sample rows, EXPLAIN) are hidden unless you
              switch them on.
            </InfoTip>
            {!paused && <span className="chip chip-ok">live</span>}
            {paused && <span className="chip">paused</span>}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/employees" target="_blank" className="btn">
              Open employee dashboard
            </Link>
            <button type="button" className="btn" onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button type="button" className="btn" onClick={clear}>
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Statements", String(stats.count)],
            ["Average time", `${stats.avg.toFixed(1)} ms`],
            ["Slowest", `${stats.max.toFixed(1)} ms`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 px-4 py-3">
              <p className="text-[12px] text-muted">{k}</p>
              <p className="num-serif text-[22px] text-ink">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`chip cursor-pointer px-3 text-[13px] ${filter === f.id ? "chip-accent" : "hover:text-ink"}`}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-muted">
            <input type="checkbox" checked={showTour} onChange={(e) => setShowTour(e.target.checked)} />
            Show this tour&apos;s own queries
          </label>
        </div>

        {visible.length === 0 ? (
          <p className="mt-5 rounded-xl bg-surface-2 p-4 text-[13.5px] text-muted">
            Nothing here yet. Open the employee dashboard and click something, then come back. Each page load and each form
            you submit appears as one or more statements.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line" aria-label="Recent statements">
            {visible.slice(0, 30).map((e) => {
              const r = readings.get(e.id);
              const active = e.id === selected?.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    aria-pressed={active}
                    className={`grid w-full grid-cols-[64px_84px_minmax(0,1fr)_72px_64px] items-center gap-x-3 px-2 py-2.5 text-left text-[13px] transition-colors ${
                      active ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="mono text-faint">{e.timestamp}</span>
                    <span className={`chip justify-self-start ${e.status === "ERROR" ? "chip-bad" : (OP_CHIP[e.operation] ?? "")}`}>
                      {e.status === "ERROR" ? "error" : e.operation.toLowerCase()}
                    </span>
                    <span className="truncate text-ink">{r?.headline ?? e.sql}</span>
                    <span className="mono text-right text-muted">{e.durationMs} ms</span>
                    <span className="text-right text-muted">{e.rowCount ?? 0} rows</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected && reading && (
        <section className="card p-5" aria-labelledby="detail-h" aria-live="polite">
          <h2 id="detail-h" className="text-[16px] font-medium text-ink">
            What this statement did
          </h2>
          <p className="mt-2 text-[14.5px] font-medium text-ink">{reading.headline}</p>
          <ul className="mt-2 space-y-1.5 text-[13.5px] text-muted">
            {reading.plain.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-faint" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
            {reading.tables.map((t) => (
              <button key={t} type="button" className="chip chip-info cursor-pointer" onClick={() => nav.openTable(t)}>
                {t}
              </button>
            ))}
            <span className="chip">{selected.durationMs} ms</span>
            <span className="chip">{selected.rowCount ?? 0} rows</span>
            <span className="chip">{selected.concept}</span>
          </div>
          <SqlView sql={selected.sql} className="mt-4" />
          {selected.params && selected.params.length > 0 && (
            <p className="mono mt-2 break-words text-[12px] text-muted">Values: {JSON.stringify(selected.params)}</p>
          )}
          {selected.error && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">{selected.error}</p>}
          {related && (
            <p className="mt-4 text-[13px] text-muted">
              Similar lesson: <span className="text-ink">{related.title}</span>.{" "}
              <button type="button" className="text-accent hover:underline" onClick={() => nav.openPlan(related.id)}>
                See how MySQL runs it
              </button>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
