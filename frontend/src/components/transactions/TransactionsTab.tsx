"use client";

import { useEffect, useState } from "react";
import type { TabProps } from "@/lib/types";
import { SCENARIOS, type Step } from "@/lib/transactions";
import { InfoTip } from "../InfoTip";
import { Timeline } from "./Timeline";
import { StateCard } from "./StateCard";

const PLAY_INTERVAL_MS = 2200;

export function TransactionsTab(props: TabProps) {
  void props;
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
      <section aria-label="Scenario" className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-medium text-ink">
          Transactions
          <InfoTip title="ACID">
            Atomic means all changes happen or none do. Consistent means the table rules always hold. Isolated and
            durable mean users do not see half-done work, and committed data survives a crash.
          </InfoTip>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
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
          <InfoTip title="REPEATABLE READ" label="More information about the default isolation level">
            MySQL&apos;s default level. A transaction reads from one snapshot taken at its first read, so repeated reads
            match, while writes still lock the rows they change.
          </InfoTip>
        </div>
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

          <p className="mt-5 flex items-start gap-2 text-[13px] text-muted" aria-live="polite">
            <span>{step ? step.narration : "Press Next or Play to run the first step."}</span>
            {step && (step.sql || step.note) && (
              <InfoTip title={step.sql ? "SQL and details" : "Details"} side="top">
                {step.sql && <code className="mb-1 block whitespace-pre-wrap">{step.sql}</code>}
                {step.note}
              </InfoTip>
            )}
          </p>
          <p className="mt-4 text-[11px] text-faint">Simulation based on InnoDB&apos;s documented behaviour, not a live trace.</p>
        </section>

        <StateCard scenario={scenario} state={state} />
      </div>
    </div>
  );
}
