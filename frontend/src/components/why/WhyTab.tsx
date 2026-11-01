"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { TabProps } from "@/lib/types";
import { SCENARIOS, resolveAll } from "@/lib/violations";
import { ScenarioView } from "./ScenarioView";

export function WhyTab({ schema }: TabProps) {
  const resolved = useMemo(() => resolveAll(schema), [schema]);
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const selected = SCENARIOS.find((s) => s.id === selectedId) ?? SCENARIOS[0];

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = SCENARIOS.findIndex((s) => s.id === selectedId);
    const next = SCENARIOS[(i + (e.key === "ArrowDown" ? 1 : -1) + SCENARIOS.length) % SCENARIOS.length];
    e.preventDefault();
    setSelectedId(next.id);
    document.getElementById(`why-item-${next.id}`)?.focus();
  };

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] items-start gap-6">
      <nav aria-label="Questions" onKeyDown={onKey} className="flex flex-col gap-3">
        <div>
          <h2 className="text-[16px] font-medium text-ink">Why can&apos;t I...?</h2>
          <p className="mt-1 text-[13px] text-muted">Pick a question, then press Play.</p>
        </div>
        <ul className="flex flex-col gap-1">
          {SCENARIOS.map((s) => {
            const active = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  id={`why-item-${s.id}`}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setSelectedId(s.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                    active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <span>{s.title}</span>
                  <span className={`chip ${s.outcome === "succeeds" ? "chip-ok" : "chip-info"}`}>{s.kind}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="card min-w-0 p-5">
        <ScenarioView key={selected.id} scenario={selected} resolved={resolved[selected.id]} />
      </div>
    </div>
  );
}
