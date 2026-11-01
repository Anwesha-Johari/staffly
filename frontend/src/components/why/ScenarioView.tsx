"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { STEPS, type ResolvedScenario, type Scenario } from "@/lib/violations";
import { InfoTip } from "../InfoTip";
import { KIND_INFO, STEP_INFO } from "./info";

type StepState = "pass" | "fail" | "faded";

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const STATE_CLASS: Record<StepState, string> = {
  pass: "chip chip-ok",
  fail: "chip chip-bad",
  faded: "chip opacity-40",
};

const STATE_TEXT: Record<StepState, string> = {
  pass: "passed",
  fail: "stopped here",
  faded: "not reached",
};

export function ScenarioView({ scenario: s, resolved }: { scenario: Scenario; resolved: ResolvedScenario }) {
  const reduced = useReducedMotion();
  const [cursorRaw, setCursorRaw] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  const rejected = s.outcome === "rejected";
  const failIdx = rejected ? STEPS.findIndex((x) => x.id === s.failStep) : -1;
  const total = failIdx >= 0 ? failIdx + 1 : STEPS.length;
  const cursor = Math.min(cursorRaw ?? total, total);
  const complete = cursor >= total;

  // Auto-play: reveal one step at a time. The timer callback owns the state change.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (cursor + 1 >= total) {
        setCursorRaw(null);
        setPlaying(false);
      } else {
        setCursorRaw(cursor + 1);
      }
    }, 650);
    return () => clearTimeout(t);
  }, [playing, cursor, total]);

  const play = () => {
    if (reduced) return;
    setCursorRaw(0);
    setPlaying(true);
  };

  const stateOf = (i: number): StepState => {
    if (i >= cursor) return "faded";
    if (failIdx >= 0 && i > failIdx) return "faded";
    if (i === failIdx) return "fail";
    return "pass";
  };

  const stepTip = (id: (typeof STEPS)[number]["id"]) => (id === "app" ? s.appTip : STEP_INFO[id]);
  const err = resolved.error;

  return (
    <div className="flex flex-col gap-5 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
          {s.title}
          <InfoTip title={s.kind}>{KIND_INFO[s.kind]}</InfoTip>
        </h2>
        <button type="button" className="btn btn-primary" onClick={play} disabled={playing || reduced}>
          Play
        </button>
      </div>

      <pre
        tabIndex={0}
        aria-label="SQL statement"
        className="mono overflow-x-auto rounded-lg bg-surface-2 p-4 text-[13px] leading-relaxed text-ink"
      >
        {s.sql}
      </pre>

      <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {STEPS.map((step, i) => {
          const state = stateOf(i);
          const okResult = step.id === "result" && !rejected && state === "pass";
          return (
            <li key={step.id} className="flex items-center gap-2">
              {i > 0 && (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="text-faint">
                  <path d="M4 2l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <span className={`${STATE_CLASS[state]} px-3! text-[13px]! ${okResult ? "chip-ok" : ""}`}>
                {step.label}
                <span className="sr-only"> ({STATE_TEXT[state]})</span>
              </span>
              <InfoTip title={step.label} align={i >= 2 ? "end" : "start"}>
                {stepTip(step.id)}
              </InfoTip>
            </li>
          );
        })}
      </ol>

      <div
        aria-live="polite"
        className={`flex flex-col gap-3 transition-opacity ${complete ? "opacity-100" : "opacity-30"}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {!resolved.ok ? (
            <>
              <span className="chip chip-warn">Schema changed</span>
              <span className="text-muted">This example no longer matches schemas.sql.</span>
              <InfoTip title="What changed" align="end">
                {resolved.problems.join(" ")}
              </InfoTip>
            </>
          ) : (
            <>
              {err ? (
                <span className="chip chip-bad">Error {err.errno}</span>
              ) : (
                <span className="chip chip-ok">Succeeds</span>
              )}
              <span className="text-muted">{s.summary}</span>
              {err && (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  Error details
                  <InfoTip title="Error details">
                    <code className="block break-words">
                      {err.errno} ({err.sqlstate}) {err.symbol}
                    </code>
                    <code className="mt-1 block break-words">{err.message}</code>
                  </InfoTip>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-muted">
                Constraint
                <InfoTip title="Constraint" align="end">
                  <code className="block break-words">{resolved.ddl}</code>
                </InfoTip>
              </span>
            </>
          )}
        </div>
        <p className="text-muted">
          <span className="text-ink">{rejected ? "Fix:" : "Tip:"}</span> {s.fix}
        </p>
      </div>
    </div>
  );
}
