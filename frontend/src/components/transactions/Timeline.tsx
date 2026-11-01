"use client";

import type { Scenario, StepResult } from "@/lib/transactions";

const RESULT_CHIP = {
  ok: { cls: "chip-ok", text: "OK" },
  empty: { cls: "", text: "0 rows" },
  blocked: { cls: "chip-warn", text: "Waiting" },
  error: { cls: "chip-bad", text: "Error" },
  info: { cls: "chip-info", text: "Info" },
} as const;

function ResultTag({ result }: { result?: StepResult }) {
  if (!result) return null;
  const m = RESULT_CHIP[result.kind];
  return <span className={`chip ${m.cls}`}>{m.text}</span>;
}

/**
 * Two lanes (Session A, Session B) with one block per step. The current step is
 * tinted; steps that have not run yet are faded. System steps span both lanes.
 */
export function Timeline({
  scenario,
  pos,
  onSelect,
}: {
  scenario: Scenario;
  pos: number;
  onSelect: (pos: number) => void;
}) {
  const twoLanes = scenario.sessions.length > 1;
  const cols = twoLanes ? "grid-cols-2" : "grid-cols-1";

  return (
    <div role="group" aria-label="Statement timeline" className="text-[13px]">
      <div className={`mb-3 grid ${cols} gap-3 text-muted`}>
        <span>Session A</span>
        {twoLanes && <span>Session B</span>}
      </div>

      <ol className="space-y-2">
        {scenario.steps.map((step) => {
          const current = step.n === pos;
          const past = step.n < pos;
          const lane =
            step.session === "system" ? (twoLanes ? "col-span-2" : "") : step.session === "B" ? "col-start-2" : "col-start-1";
          return (
            <li key={step.n} className={`grid ${cols} gap-3`}>
              <button
                type="button"
                onClick={() => onSelect(step.n)}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${step.n}: ${step.title}`}
                className={`${lane} flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                  current
                    ? "bg-accent-soft text-ink"
                    : past
                      ? "bg-surface-2 text-ink hover:bg-surface-3"
                      : "bg-surface-2 text-faint hover:bg-surface-3"
                }`}
              >
                <span>
                  <span className="mono mr-2 text-faint">{step.n}</span>
                  {step.title}
                </span>
                {(current || past) && <ResultTag result={step.result} />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
