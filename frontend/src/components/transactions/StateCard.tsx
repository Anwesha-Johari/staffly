"use client";

import { InfoTip } from "../InfoTip";
import type { LockEntry, RowState, Scenario, StepState, TxStateName, UndoEntry, VersionState } from "@/lib/transactions";
import { WaitForGraph } from "./WaitForGraph";

const TX_CHIP: Record<TxStateName, string> = {
  "NOT STARTED": "",
  ACTIVE: "chip-info",
  WAITING: "chip-warn",
  COMMITTED: "chip-ok",
  "ROLLED BACK": "chip-bad",
};

const TX_LABEL: Record<TxStateName, string> = {
  "NOT STARTED": "not started",
  ACTIVE: "active",
  WAITING: "waiting",
  COMMITTED: "committed",
  "ROLLED BACK": "rolled back",
};

const VERSION_CHIP: Record<VersionState, { text: string; cls: string }> = {
  committed: { text: "committed", cls: "chip-ok" },
  uncommitted: { text: "uncommitted", cls: "chip-warn" },
  old: { text: "old version", cls: "chip-info" },
};

const UNDO_CHIP: Record<UndoEntry["state"], string> = {
  active: "chip-info",
  applied: "chip-bad",
  retained: "chip-warn",
  freed: "",
};

const fmt = (n: number) => n.toLocaleString("en-US");

/** Rows worth showing: changed since the start, written by an open trx, or carrying an old version. */
function affectedRows(scenario: Scenario, rows: RowState[]): RowState[] {
  const initial = new Set(scenario.initial.rows.map((r) => JSON.stringify(r)));
  return rows.filter(
    (r) => r.versions.length > 1 || r.versions[0].state !== "committed" || !initial.has(JSON.stringify(r)),
  );
}

function lockLabel(l: LockEntry): string {
  const where = l.scope === "table" ? `${l.object} table` : l.object.slice(l.object.indexOf(" ") + 1);
  return `${l.session}: ${l.mode} on ${where}`;
}

function Label({ children, tip, tipTitle }: { children: React.ReactNode; tip: React.ReactNode; tipTitle: string }) {
  return (
    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
      {children}
      <InfoTip title={tipTitle}>{tip}</InfoTip>
    </h3>
  );
}

export function StateCard({ scenario, state }: { scenario: Scenario; state: StepState }) {
  const rows = affectedRows(scenario, state.rows);
  const deadlock = scenario.id === "deadlock";
  const cycle = state.waitFor.length > 1;

  return (
    <section className="card space-y-6 p-5" aria-label="Database state">
      <h2 className="flex items-center gap-2 text-base font-medium text-ink">
        State
        <InfoTip title="Database state">
          This panel shows only what the current step touches. Row versions come from MVCC: InnoDB keeps old versions so
          readers never wait for writers.
        </InfoTip>
      </h2>

      <div className="flex flex-wrap gap-2" aria-label="Session states">
        {scenario.sessions.map((s) => {
          const t = state.tx[s].state;
          return (
            <span key={s} className={`chip ${TX_CHIP[t]}`}>
              Session {s}: {TX_LABEL[t]}
            </span>
          );
        })}
      </div>

      <div className="text-[13px]">
        <Label
          tipTitle="Row versions"
          tip="Each change creates a new version. The old one stays in the undo log until no snapshot needs it."
        >
          Rows
        </Label>
        <p className="mono mb-2 text-[12px] text-faint">
          {scenario.table.name}({scenario.table.columns.join(", ")})
        </p>
        {rows.length === 0 ? (
          <p className="text-muted">No rows changed yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.flatMap((r, ri) =>
              r.versions.map((v, vi) => {
                const c = VERSION_CHIP[v.state];
                return (
                  <li key={`${ri}-${vi}`} className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${v.state === "old" ? "text-faint" : "text-ink"}`}>
                    <span className={`chip ${c.cls}`}>{c.text}</span>
                    <span className="mono text-[12px]">{v.values.join(", ")}</span>
                  </li>
                );
              }),
            )}
          </ul>
        )}
      </div>

      <div className="text-[13px]">
        <Label
          tipTitle="Locks"
          tip="X means exclusive: nobody else can change the row. S means shared. IX and IS are table-level notes that row locks exist."
        >
          Locks
        </Label>
        {state.locks.length === 0 ? (
          <p className="text-muted">None held.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {state.locks.map((l, i) => (
              <li key={i}>
                <span className={`chip mono ${l.status === "waiting" ? "chip-warn" : ""}`}>
                  {lockLabel(l)}
                  {l.status === "waiting" && " (waiting)"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deadlock && (
        <div className="text-[13px]">
          <Label
            tipTitle="Wait-for graph"
            tip="An arrow points from a session to the session it waits for. A cycle means deadlock, so InnoDB rolls one session back."
          >
            Waiting
            {cycle && <span className="chip chip-bad">cycle</span>}
          </Label>
          <WaitForGraph state={state} deadlock={cycle} />
        </div>
      )}

      <details className="text-[13px]">
        <summary className="cursor-pointer text-muted hover:text-ink">Engine internals</summary>
        <div className="mt-4 space-y-5">
          <div>
            <Label
              tipTitle="Undo log"
              tip="Before changing a row, InnoDB records how to reverse it. Rollback and old snapshots both use these records."
            >
              Undo log
            </Label>
            {state.undo.length === 0 ? (
              <p className="text-muted">Empty.</p>
            ) : (
              <ul className="space-y-1.5">
                {state.undo.map((u) => (
                  <li key={u.id} className="flex items-center gap-2">
                    <span className="mono text-[12px] text-faint">{u.id}</span>
                    <span className="flex-1 text-muted">{u.text}</span>
                    <span className={`chip ${UNDO_CHIP[u.state]}`}>{u.state}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <Label
              tipTitle="Redo log"
              tip="Every change is also written to the redo log. COMMIT flushes it to disk, so a crash can be replayed. LSN is the log position."
            >
              Redo log
            </Label>
            {state.redo.length === 0 ? (
              <p className="text-muted">Empty.</p>
            ) : (
              <ul className="space-y-1.5">
                {state.redo.map((e) => (
                  <li key={e.lsn} className="flex items-center gap-2">
                    <span className="mono text-[12px] text-faint">{fmt(e.lsn)}</span>
                    <span className="flex-1 text-muted">{e.text}</span>
                    <span className={`chip ${e.flushed ? "chip-ok" : "chip-warn"}`}>{e.flushed ? "on disk" : "in memory"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
