"use client";

import { useState } from "react";
import type { LiveState } from "@/lib/types";
import { InfoTip } from "../InfoTip";

interface DemoStep {
  session: "A" | "B" | "system";
  sql: string;
  result: string;
  ms: number;
  kind: "ok" | "wait" | "error";
}
type Outcome = { ok: true; steps: DemoStep[]; summary: string } | { ok: false; reason: string };

const KIND_CHIP: Record<DemoStep["kind"], string> = { ok: "chip-ok", wait: "chip-warn", error: "chip-bad" };
const KIND_LABEL: Record<DemoStep["kind"], string> = { ok: "ok", wait: "waiting", error: "error" };

/** Plays the scenario for real on two live connections (scratch table, nothing of yours is touched). */
export function RealRun({ scenarioId, live }: { scenarioId: string; live: LiveState | null }) {
  const [state, setState] = useState<{ id: string; status: "running" | "done"; outcome?: Outcome } | null>(null);
  const connected = !!live?.connected;
  const current = state?.id === scenarioId ? state : null;

  const run = async () => {
    setState({ id: scenarioId, status: "running" });
    try {
      const res = await fetch("/api/txdemo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scenarioId }),
        cache: "no-store",
      });
      setState({ id: scenarioId, status: "done", outcome: (await res.json()) as Outcome });
    } catch {
      setState({ id: scenarioId, status: "done", outcome: { ok: false, reason: "endpoint not reachable" } });
    }
  };

  return (
    <section className="card p-5" aria-labelledby="real-h">
      <h2 id="real-h" className="flex items-center gap-2 text-[16px] font-medium text-ink">
        Now run it for real
        <InfoTip title="How this stays safe">
          The dashboard opens two real MySQL connections and plays exactly this script on a temporary scratch table that it
          creates and drops in the same request. Your Staffly tables are never read or changed.
        </InfoTip>
      </h2>
      <p className="mt-1 text-[13.5px] text-muted">
        The timeline above is a scripted drawing. This button makes two real sessions do the same thing and shows what MySQL
        actually answered, including how long each statement had to wait.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" onClick={run} disabled={!connected || current?.status === "running"}>
          {current?.status === "running" ? "Running two sessions" : "Run on the real database"}
        </button>
        {!connected && <span className="text-[12.5px] text-muted">Connect a database to run this for real.</span>}
      </div>

      {current?.outcome && !current.outcome.ok && (
        <p className="mt-3 text-[13px] text-muted" role="status">
          Could not run it: {current.outcome.reason}.
        </p>
      )}
      {current?.outcome?.ok && (
        <div className="mt-4">
          <p className="rounded-xl bg-accent-soft px-4 py-3 text-[13.5px] text-ink">{current.outcome.summary}</p>
          <ol className="mt-3 divide-y divide-line text-[12.5px]">
            {current.outcome.steps.map((s, i) => (
              <li key={i} className="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[70px_minmax(0,1.3fr)_minmax(0,1fr)_60px]">
                <span className={`chip ${s.session === "A" ? "chip-info" : s.session === "B" ? "chip-accent" : ""} self-start justify-self-start`}>
                  {s.session === "system" ? "setup" : `Session ${s.session}`}
                </span>
                <code className="mono break-words text-ink">{s.sql}</code>
                <span className="flex flex-wrap items-start gap-2 text-ink">
                  <span className={`chip ${KIND_CHIP[s.kind]}`}>{KIND_LABEL[s.kind]}</span>
                  <span className="min-w-0 break-words">{s.result}</span>
                </span>
                <span className="mono text-right text-muted">{s.ms} ms</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-faint">The scratch table was dropped afterwards. Nothing of yours changed.</p>
        </div>
      )}
    </section>
  );
}
