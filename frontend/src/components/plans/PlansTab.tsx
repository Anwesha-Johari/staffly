"use client";

import { useState } from "react";
import { LIBRARY } from "@/lib/library";
import type { LibraryQuery, TabProps } from "@/lib/types";
import { Explainer } from "../Explainer";
import { InfoTip } from "../InfoTip";
import { SqlView } from "../SqlView";
import { ACCESS_META, ACCESS_ORDER, TONE_CHIP } from "./accessTypes";
import { PlanTree } from "./PlanTree";
import { flatten } from "./planUtils";
import { Steps } from "./Steps";

const CATEGORIES = [...new Set(LIBRARY.map((q) => q.category))];

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "live"; tree: string; version: string | null }
  | { kind: "unavailable"; reason: string };

/** Parse the /api/explain response defensively; anything unexpected is "unavailable". */
async function runExplain(id: string): Promise<Result> {
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const b = body as { ok?: unknown; tree?: unknown; serverVersion?: unknown; reason?: unknown };
      if (b.ok === true && typeof b.tree === "string" && b.tree.trim()) {
        return { kind: "live", tree: b.tree, version: typeof b.serverVersion === "string" ? b.serverVersion : null };
      }
      if (typeof b.reason === "string") return { kind: "unavailable", reason: b.reason };
    }
    return { kind: "unavailable", reason: "unexpected response" };
  } catch {
    return { kind: "unavailable", reason: "endpoint not reachable" };
  }
}

function pickInitial(selectedQueryId: string | null): string {
  return LIBRARY.some((q) => q.id === selectedQueryId) ? (selectedQueryId as string) : LIBRARY[0].id;
}

/** Plain-English notes for the operators that appear in MySQL's real EXPLAIN FORMAT=TREE output. */
const REAL_NOTES: [RegExp, string][] = [
  [/Rows fetched before execution/i, "Rows fetched before execution: MySQL already read this single row while planning (a primary or unique key lookup), so nothing is left to run."],
  [/Single-row index lookup/i, "Single-row index lookup: one index probe finds exactly one row. This is the cheapest way to read a table."],
  [/Index lookup/i, "Index lookup: the index jumps straight to the matching rows, so MySQL does not read the whole table."],
  [/Index range scan/i, "Index range scan: only a slice of the index is read, such as one month of dates."],
  [/Covering index/i, "Covering index: the index alone holds every column needed, so the table itself is never touched."],
  [/Index scan/i, "Index scan: every entry of an index is read in order. Cheaper than a table scan, but still all rows."],
  [/Table scan/i, "Table scan: every row of the table is read. Fine for tiny tables, slow for big ones."],
  [/Filter:/i, "Filter: rows are read first and then tested against the WHERE condition. If no index helps, the whole table is read."],
  [/Nested loop (left |inner )?join/i, "Nested loop join: for each row from the first table, MySQL looks up the matching row in the next one."],
  [/Sort/i, "Sort: MySQL orders the rows itself because no index gives them in that order."],
  [/Aggregate/i, "Aggregate: rows are counted or summed into one result."],
];

/** The main visual: the plan tree with a one-line caption for the selected node. */
function PlanCard({ query, result }: { query: LibraryQuery; result: Result }) {
  const flat = flatten(query.plan);
  const [selectedId, setSelectedId] = useState("0");
  const [showLive, setShowLive] = useState(true);
  const selected = flat.find((f) => f.id === selectedId) ?? flat[0];
  const live = result.kind === "live" && showLive ? result : null;

  return (
    <section className="card p-5" aria-labelledby="plan-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-h" className="flex items-center gap-2 text-[16px] font-medium text-ink">
          The plan MySQL picks
          <InfoTip title="Reading the tree">
            <span className="block">
              Read from the top: table reads feed the steps below, and the last box returns rows. The plan is derived from
              schemas.sql indexes, not run on a database. Bars show estimated rows.
            </span>
            <span className="mt-2 block space-y-1">
              {ACCESS_ORDER.map((a) => (
                <span key={a} className="block">
                  <span className={`chip mono ${TONE_CHIP[ACCESS_META[a].tone]}`}>{a}</span> {ACCESS_META[a].tip}
                </span>
              ))}
            </span>
          </InfoTip>
          {!live && <span className="chip chip-warn">illustrative</span>}
          {live && <span className="chip chip-ok">live</span>}
        </h2>
        {result.kind === "live" && (
          <button type="button" className="btn" onClick={() => setShowLive((v) => !v)}>
            {showLive ? "Show diagram" : "Show live plan"}
          </button>
        )}
      </div>

      {live ? (
        <>
          <pre className="mono mt-4 max-h-[340px] overflow-auto whitespace-pre rounded-lg bg-surface-2 p-4 text-[12px] leading-relaxed text-ink">
            {live.tree}
          </pre>
          <p className="mt-3 text-[13px] text-muted">
            Real <code>EXPLAIN FORMAT=TREE</code> from MySQL {live.version ?? "(version unknown)"}. Read it from the inside out:
            the most indented line runs first. How to read what you see:
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-ink">
            {REAL_NOTES.filter(([re]) => re.test(live.tree)).map(([, note]) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-faint" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto pb-1">
            <PlanTree root={query.plan} selectedId={selected.id} onSelect={setSelectedId} />
          </div>
          <p className="mt-4 text-[13px] text-muted" aria-live="polite">
            <span className="font-medium text-ink">{selected.node.op}.</span> {selected.node.why}
          </p>
        </>
      )}
    </section>
  );
}

interface RunData {
  ok: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  durationMs?: number;
  reason?: string;
}

const cell = (v: unknown) =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "string"
      ? v.replace(/T00:00:00\.000Z$/, "").replace(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d:\d\d)\.\d+Z$/, "$1 $2")
      : String(v);

export function PlansTab({ selectedQueryId, live }: TabProps) {
  const [primaryId, setPrimaryId] = useState(() => pickInitial(selectedQueryId));
  const [result, setResult] = useState<Result>({ kind: "idle" });
  const [run, setRun] = useState<{ id: string; data: RunData } | { id: string; data: null } | null>(null);

  const choose = (id: string) => {
    setPrimaryId(id);
    setResult({ kind: "idle" });
    setRun(null);
  };

  // If another tab opens a plan while this tab is mounted, follow it.
  const [seenSelected, setSeenSelected] = useState(selectedQueryId);
  if (selectedQueryId !== seenSelected) {
    setSeenSelected(selectedQueryId);
    if (selectedQueryId && LIBRARY.some((q) => q.id === selectedQueryId)) choose(selectedQueryId);
  }

  const query = LIBRARY.find((q) => q.id === primaryId) as LibraryQuery;
  const selectOnly = /^\s*select\b/i.test(query.sql);
  const connected = !!live?.connected;

  const onExplain = async () => {
    const id = query.id;
    setResult({ kind: "loading" });
    setResult(await runExplain(id));
  };

  const onRun = async () => {
    const id = query.id;
    setRun({ id, data: null });
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        cache: "no-store",
      });
      setRun({ id, data: (await res.json()) as RunData });
    } catch {
      setRun({ id, data: { ok: false, reason: "endpoint not reachable" } });
    }
  };

  const runData = run && run.id === query.id ? run.data : null;
  const running = run?.id === query.id && run.data === null;

  return (
    <div className="flex flex-col gap-6">
      <Explainer
        title="How a query runs"
        steps={[
          "Pick one of the real queries the Staffly app sends.",
          "Read what it asks for, in plain words.",
          "See the five stages MySQL puts it through.",
          "Compare the plan with MySQL's real EXPLAIN.",
        ]}
        tryThis="Compare 'Search employee by numeric id' with 'Search employee by name fragment' and look at the access type."
      >
        You tell the database what you want in SQL, never how to get it. MySQL parses the text, picks the cheapest plan, and
        then reads the data, using an index when it can so it avoids reading every row.
      </Explainer>

      <section className="card p-5" aria-labelledby="query-h">
        <h2 id="query-h" className="text-[16px] font-medium text-ink">
          The query
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="plan-query" className="sr-only">
            Query
          </label>
          <select
            id="plan-query"
            value={primaryId}
            onChange={(e) => choose(e.target.value)}
            className="field w-auto min-w-[260px] max-w-full flex-1 sm:max-w-md"
          >
            {CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {LIBRARY.filter((q) => q.category === cat).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="chip">{query.category}</span>
          {query.concepts.slice(0, 2).map((c) => (
            <span key={c} className="chip chip-info">
              {c}
            </span>
          ))}
        </div>

        <p className="mt-4 text-[14px] leading-relaxed text-ink">{query.summary}</p>
        <p className="mt-1 text-[12.5px] text-muted">
          Used by <span className="mono">{query.fn}</span> in the Python backend. Tables: {query.tables.join(", ")}.
        </p>

        <SqlView sql={query.sql} params={query.params} className="mt-4" />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={onRun} disabled={!selectOnly || !connected || running}>
            {running ? "Running" : "Run it"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={onExplain}
            disabled={!selectOnly || !connected || result.kind === "loading"}
          >
            {result.kind === "loading" ? "Asking MySQL" : "Show MySQL's real plan"}
          </button>
          <InfoTip title="Run it and EXPLAIN">
            Run it executes this SELECT with sample values against the live database, in a read-only transaction that is rolled
            back, and shows up to 10 rows. EXPLAIN asks MySQL for the plan it would use, without running the query.
          </InfoTip>
          {!connected && <span className="text-[12.5px] text-muted">Connect a database to run queries for real.</span>}
          {connected && !selectOnly && (
            <span className="text-[12.5px] text-muted">This statement changes data, so it is not run from here.</span>
          )}
        </div>

        {result.kind === "unavailable" && (
          <p className="mt-2 text-[12.5px] text-muted" role="status">
            No live plan ({result.reason}); showing the illustrative one below.
          </p>
        )}

        {runData && !runData.ok && (
          <p className="mt-3 text-[13px] text-muted" role="status">
            Could not run it: {runData.reason}.
          </p>
        )}
        {runData?.ok && (
          <div className="mt-4">
            <p className="text-[13px] text-muted">
              <span className="chip chip-ok mr-2">live</span>
              {runData.rowCount} row{runData.rowCount === 1 ? "" : "s"} in {runData.durationMs} ms
              {runData.rowCount && runData.rowCount > (runData.rows?.length ?? 0) ? ` (showing the first ${runData.rows?.length})` : ""}
              . Passwords are never shown.
            </p>
            <div className="mt-2 overflow-x-auto rounded-xl bg-surface-2">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="text-faint">
                    {runData.columns?.map((c) => (
                      <th key={c} className="mono whitespace-nowrap px-3 py-2 font-normal">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runData.rows?.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {runData.columns?.map((c) => (
                        <td key={c} className={`mono whitespace-nowrap px-3 py-2 ${r[c] == null ? "text-faint" : "text-ink"}`}>
                          {cell(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <Steps key={`steps-${query.id}`} query={query} />
      <PlanCard key={`${query.id}-${result.kind === "live" ? "live" : "static"}`} query={query} result={result} />
    </div>
  );
}
