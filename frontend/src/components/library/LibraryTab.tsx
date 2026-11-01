"use client";

import { useState } from "react";
import type { LibraryQuery, TabProps } from "@/lib/types";
import { LIBRARY } from "@/lib/library";
import { InfoTip } from "../InfoTip";
import { AccessBadge, AccessTypeLegend } from "./AccessBadge";
import { SqlView } from "./SqlView";
import { CATEGORY_INFO, conceptInfo } from "./concepts";

type Category = LibraryQuery["category"];

const CATEGORIES = Object.keys(CATEGORY_INFO) as Category[];

function Pill({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`chip cursor-pointer transition-colors hover:text-ink ${active ? "chip-accent" : ""}`}
    >
      {label}
    </button>
  );
}

function QueryRow({ query, props }: { query: LibraryQuery; props: TabProps }) {
  const selected = props.selectedQueryId === query.id;
  const [open, setOpen] = useState(selected);
  const panelId = `query-${query.id}`;

  return (
    <li className={selected ? "bg-surface-2" : ""}>
      <div className="flex items-center gap-3 px-5 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
          >
            <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate text-[14px] font-medium text-ink">{query.title}</span>
        </button>
        <span className="chip chip-accent shrink-0">{query.category}</span>
        <span className="hidden shrink-0 items-center gap-1.5 lg:inline-flex">
          {query.concepts.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </span>
        <span className="w-14 shrink-0 text-right">
          <AccessBadge plan={query.plan} />
        </span>
      </div>

      {open && (
        <div id={panelId} className="space-y-4 pb-5 pl-[52px] pr-5">
          <p className="max-w-[80ch] text-[14px] text-muted">{query.summary}</p>
          <SqlView sql={query.sql} params={query.params} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" className="btn btn-primary" onClick={() => props.nav.openPlan(query.id)}>
              Show plan
            </button>
            <span className="text-[12px] text-faint">Tables: {query.tables.join(", ")}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
              Concepts
              {query.concepts.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 text-muted">
                  {c}
                  <InfoTip title={c} side="top">
                    {conceptInfo(c)}
                  </InfoTip>
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

export function LibraryTab(props: TabProps) {
  const [category, setCategory] = useState<Category | null>(null);
  const visible = LIBRARY.filter((q) => !category || q.category === category);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
            Query library
            <InfoTip title="About this library">
              Every statement is copied from employee_backend.py, with %s shown as ?. Plans are illustrations based on the
              indexes in schemas.sql, not captured EXPLAIN output.
            </InfoTip>
          </h2>
          <p className="mt-1 text-[14px] text-muted">Real queries from the backend, each with the plan MySQL would likely pick.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
          <Pill label="All" active={category === null} onToggle={() => setCategory(null)} />
          {CATEGORIES.map((c) => (
            <Pill key={c} label={c} active={category === c} onToggle={() => setCategory(category === c ? null : c)} />
          ))}
          <InfoTip title="Categories">
            {CATEGORIES.map((c) => (
              <span key={c} className="mb-1 block last:mb-0">
                <code>{c}</code>: {CATEGORY_INFO[c]}
              </span>
            ))}
          </InfoTip>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-1 pt-4 text-[12px] text-faint">
          <span aria-live="polite">
            {visible.length} {visible.length === 1 ? "query" : "queries"}
          </span>
          <span className="inline-flex items-center gap-1">
            Access
            <InfoTip title="Access type, best to worst" align="end">
              <AccessTypeLegend />
            </InfoTip>
          </span>
        </div>
        <ul className="divide-y divide-line">
          {visible.map((q) => (
            <QueryRow key={q.id} query={q} props={props} />
          ))}
        </ul>
      </section>
    </div>
  );
}
