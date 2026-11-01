"use client";

import { useState } from "react";
import { LIBRARY } from "@/lib/library";
import type { LibraryQuery, TabProps } from "@/lib/types";
import { InfoTip } from "../InfoTip";
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
          Plan tree
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
          <p className="mt-3 text-[13px] text-muted">EXPLAIN FORMAT=TREE from MySQL {live.version ?? "(version unknown)"}.</p>
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

export function PlansTab({ selectedQueryId }: TabProps) {
  const [primaryId, setPrimaryId] = useState(() => pickInitial(selectedQueryId));
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const choose = (id: string) => {
    setPrimaryId(id);
    setResult({ kind: "idle" });
  };

  // If another tab opens a plan while this tab is mounted, follow it.
  const [seenSelected, setSeenSelected] = useState(selectedQueryId);
  if (selectedQueryId !== seenSelected) {
    setSeenSelected(selectedQueryId);
    if (selectedQueryId && LIBRARY.some((q) => q.id === selectedQueryId)) choose(selectedQueryId);
  }

  const query = LIBRARY.find((q) => q.id === primaryId) as LibraryQuery;
  const selectOnly = /^\s*select\b/i.test(query.sql);

  const onRun = async () => {
    const id = query.id;
    setResult({ kind: "loading" });
    const r = await runExplain(id);
    setResult(r);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
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
          <InfoTip title={query.title}>
            {query.summary}
            {selectOnly ? "" : " EXPLAIN is offered for SELECT statements only."}
          </InfoTip>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRun}
            disabled={!selectOnly || result.kind === "loading"}
          >
            {result.kind === "loading" ? "Running" : "Run EXPLAIN"}
          </button>
        </div>
        {result.kind === "unavailable" && (
          <p className="mt-2 text-[12px] text-muted" role="status">
            No live plan ({result.reason}); showing the illustrative one.
          </p>
        )}
      </div>

      <PlanCard key={`${query.id}-${result.kind === "live" ? "live" : "static"}`} query={query} result={result} />
      <Steps key={`steps-${query.id}`} query={query} />
    </div>
  );
}
