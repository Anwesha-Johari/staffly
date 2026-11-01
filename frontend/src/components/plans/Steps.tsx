"use client";

import { useMemo } from "react";
import type { LibraryQuery } from "@/lib/types";
import { buildStages } from "./pipelineDetail";

/** The five stages every statement passes through, each with a visible explanation. */
export function Steps({ query }: { query: LibraryQuery }) {
  const stages = useMemo(() => buildStages(query), [query]);

  return (
    <section className="card p-5" aria-labelledby="steps-h">
      <h2 id="steps-h" className="text-[16px] font-medium text-ink">
        What MySQL does, step by step
      </h2>
      <p className="mt-1 text-[13.5px] text-muted">
        Every SQL statement goes through the same five stages. The right-hand text shows what each stage does for this query.
      </p>

      <ol className="mt-5 space-y-4">
        {stages.map((s, i) => (
          <li key={s.id} className="grid gap-x-5 gap-y-1 sm:grid-cols-[28px_130px_1fr_1fr]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[12px] font-medium text-accent">
              {i + 1}
            </span>
            <span className="text-[14px] font-medium text-ink">{s.name}</span>
            <span className="text-[13px] leading-relaxed text-muted">{s.tip}</span>
            <span className="text-[13px] leading-relaxed text-ink">{s.line}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
