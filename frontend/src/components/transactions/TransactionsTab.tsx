"use client";

import { useEffect, useState } from "react";
import type { TabProps } from "@/lib/types";
import { SCENARIOS, type Step } from "@/lib/transactions";
import { Explainer } from "../Explainer";
import { InfoTip } from "../InfoTip";
import { RealRun } from "./RealRun";
import { Timeline } from "./Timeline";
import { StateCard } from "./StateCard";

const PLAY_INTERVAL_MS = 2200;

export function TransactionsTab({ live }: TabProps) {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const total = scenario.steps.length;
  const step: Step | null = pos > 0 ? scenario.steps[pos - 1] : null;
  const state = step ? step.effects : scenario.initial;

  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => {
      setPos(pos + 1);
      if (pos + 1 >= total) setPlaying(false);
    }, PLAY_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [playing, pos, total]);

  const choose = (id: string) => {
    setScenarioId(id);
    setPos(0);
    setPlaying(false);
  };
  const go = (next: number) => {
    setPlaying(false);
    setPos(Math.max(0, Math.min(total, next)));
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (pos >= total) setPos(0);
    setPlaying(true);
  };

  return (
    <div className="space-y-6">
      <Explainer
        title="Transactions: all or nothing, even with many users"
        steps={[
          "Pick a story with two users, A and B.",
          "Press Next to move one step at a time.",
          "Read what happens, and the SQL behind it.",
          "Check which rows are locked or changed.",
        ]}
        tryThis="Choose 'Two users approve the same leave' and watch what happens to B when A holds the lock."
      >
        A transaction groups SQL statements so they succeed together or not at all (COMMIT or ROLLBACK). While a transaction
        changes a row, InnoDB locks it, so a second user waits instead of overwriting the change. These stories show that, and
        a deadlock when two users wait for each other.
      </Explainer>

      <section aria-label="Scenario" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-muted">Story:</span>
        <div role="group" aria-label="Choose a scenario" className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === scenario.id}
              onClick={() => choose(s.id)}
              className={`chip cursor-pointer px-3 text-[13px] transition-colors ${
                s.id === scenario.id ? "chip-accent" : "hover:text-ink"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
        <InfoTip title="ACID and isolation">
          Atomic: all changes happen or none do. Consistent: table rules always hold. Isolated: users do not see each other&apos;s
          half-done work. Durable: committed data survives a crash. MySQL&apos;s default level, REPEATABLE READ, reads from one
          snapshot per transaction while writes still lock the rows they change.
        </InfoTip>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5" aria-label="Timeline">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-medium text-ink">Timeline</h2>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-[13px] text-muted">
                Step {pos} of {total}
              </span>
              <button type="button" className="btn" onClick={() => go(pos - 1)} disabled={pos === 0}>
                Prev
              </button>
              <button type="button" className="btn btn-primary" onClick={togglePlay}>
                {playing ? "Pause" : pos >= total ? "Replay" : "Play"}
              </button>
              <button type="button" className="btn" onClick={() => go(pos + 1)} disabled={pos >= total}>
                Next
              </button>
            </div>
          </div>

          <Timeline scenario={scenario} pos={pos} onSelect={go} />

          <div className="mt-5 rounded-xl bg-surface-2 p-4" aria-live="polite">
            <p className="text-[12px] font-medium uppercase tracking-wide text-faint">What happens</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink">
              {step ? step.narration : "Press Next or Play to run the first step."}
            </p>
            {step?.sql && (
              <code className="mono mt-3 block whitespace-pre-wrap break-words rounded-lg bg-surface p-3 text-[12.5px] text-ink">
                {step.sql}
              </code>
            )}
            {step?.note && (
              <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
                <span>{step.note}</span>
              </p>
            )}
          </div>
          <p className="mt-4 text-[11px] text-faint">Simulation based on InnoDB&apos;s documented behaviour, not a live trace.</p>
        </section>

        <StateCard scenario={scenario} state={state} />
      </div>

      {(scenario.id === "leave-race" || scenario.id === "deadlock") && <RealRun scenarioId={scenario.id} live={live} />}
    </div>
  );
}
