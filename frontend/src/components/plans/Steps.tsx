"use client";

import { useMemo, useState } from "react";
import type { LibraryQuery } from "@/lib/types";
import { InfoTip } from "../InfoTip";
import { buildStages, type StageId } from "./pipelineDetail";

export function Steps({ query }: { query: LibraryQuery }) {
  const stages = useMemo(() => buildStages(query), [query]);
  const [active, setActive] = useState<StageId>("parse");
  const stage = stages.find((s) => s.id === active) ?? stages[0];

  return (
    <section className="card p-5" aria-labelledby="steps-h">
      <h2 id="steps-h" className="flex items-center gap-2 text-[16px] font-medium text-ink">
        Steps
        <InfoTip title="Statement pipeline">
          Every SQL statement passes through these five stages. Select one to see what it does for this query.
        </InfoTip>
      </h2>

      <ol className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Pipeline stages">
        {stages.map((s) => (
          <li key={s.id} className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActive(s.id)}
              aria-pressed={s.id === active}
              className={`chip cursor-pointer px-3 transition-colors ${s.id === active ? "chip-accent" : "hover:bg-line"}`}
            >
              {s.name}
            </button>
            <InfoTip title={s.name}>{s.tip}</InfoTip>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[13px] text-muted" aria-live="polite">
        {stage.line}
      </p>
    </section>
  );
}
