"use client";

import { useEffect, useState } from "react";
import type { LiveState } from "@/lib/types";
import { InfoTip } from "../InfoTip";

interface Sample {
  ok: boolean;
  columns?: string[];
  hidden?: number;
  rows?: Record<string, unknown>[];
  reason?: string;
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "string") return v.replace(/T00:00:00\.000Z$/, "").replace(/^(\d{4}-\d\d-\d\d)T(\d\d:\d\d:\d\d)\.\d+Z$/, "$1 $2");
  return String(v);
}

/** The first rows really stored in the table, read from the live database. */
export function SampleRows({ table, live }: { table: string; live: LiveState | null }) {
  const [data, setData] = useState<{ table: string; sample: Sample } | null>(null);
  const connected = !!live?.connected;

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    fetch(`/api/table?name=${encodeURIComponent(table)}`, { cache: "no-store" })
      .then((r) => r.json() as Promise<Sample>)
      .then((sample) => !cancelled && setData({ table, sample }))
      .catch(() => !cancelled && setData({ table, sample: { ok: false, reason: "request failed" } }));
    return () => {
      cancelled = true;
    };
  }, [table, connected]);

  const sample = data?.table === table ? data.sample : null;

  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-[14px] font-medium text-ink">
        Rows stored right now
        <InfoTip title="Sample rows">
          These are the first 5 rows of the table, ordered by primary key and read straight from MySQL with{" "}
          <code>SELECT ... LIMIT 5</code>. {sample?.hidden ? "The password_hash column is never sent to the browser." : ""}
        </InfoTip>
        {connected && sample?.ok && <span className="chip chip-ok">live</span>}
      </h3>
      {!connected ? (
        <p className="mt-2 text-[13px] text-muted">Connect a database to see the real rows of this table.</p>
      ) : !sample ? (
        <p className="mt-2 text-[13px] text-muted">Loading rows...</p>
      ) : !sample.ok ? (
        <p className="mt-2 text-[13px] text-muted">Could not read rows ({sample.reason}).</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl bg-surface-2">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="text-faint">
                {sample.columns?.map((c) => (
                  <th key={c} className="mono whitespace-nowrap px-3 py-2 font-normal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sample.rows?.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {sample.columns?.map((c) => (
                    <td key={c} className={`mono whitespace-nowrap px-3 py-2 ${r[c] == null ? "text-faint" : "text-ink"}`}>
                      {show(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
