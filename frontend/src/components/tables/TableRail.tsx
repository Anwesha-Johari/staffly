"use client";

import { useRef, type KeyboardEvent } from "react";
import type { Table } from "@/lib/types";

export function TableRail({
  tables,
  selected,
  onSelect,
}: {
  tables: Table[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tables.findIndex((t) => t.name === selected);
    let next = i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = Math.min(tables.length - 1, i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tables.length - 1;
    else return;
    e.preventDefault();
    const name = tables[next].name;
    onSelect(name);
    refs.current[name]?.focus();
  };

  return (
    <div role="listbox" aria-label="Tables" aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col gap-1">
      {tables.map((t) => {
        const active = t.name === selected;
        return (
          <button
            key={t.name}
            ref={(el) => {
              refs.current[t.name] = el;
            }}
            type="button"
            role="option"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t.name)}
            className={`flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
              active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2"
            }`}
          >
            <span className="mono truncate">{t.name}</span>
            <span className="shrink-0 text-faint">{t.columns.length}</span>
          </button>
        );
      })}
    </div>
  );
}
