"use client";

import type { Table, TableIndex } from "@/lib/types";
import { InfoTip } from "../InfoTip";
import { BTreeDiagram } from "./BTreeDiagram";

function oneLine(ix: TableIndex): string {
  if (ix.kind === "PRIMARY") return "Clustered: rows are stored in this order.";
  if (ix.kind === "UNIQUE") return "Blocks duplicate values and speeds up lookups.";
  if (!ix.explicit) return "Added by InnoDB to check a foreign key quickly.";
  return "Speeds up searches on these columns.";
}

export function IndexesBlock({ table }: { table: Table }) {
  return (
    <details className="group border-b border-line py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block text-faint transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
        Indexes ({table.indexes.length})
        <InfoTip title="Indexes">
          An index is a sorted copy of some columns, stored as a B+tree. It lets MySQL jump to rows instead of
          reading the whole table. Every write must update it too.
        </InfoTip>
      </summary>

      <div className="mt-3 grid gap-5 pl-4 text-[13px]">
        <ul className="m-0 grid list-none gap-2 p-0">
          {table.indexes.map((ix) => (
            <li key={ix.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="mono font-medium text-ink">{ix.name}</span>
              <span className={`chip ${ix.kind === "PRIMARY" ? "chip-accent" : ix.kind === "UNIQUE" ? "chip-info" : ""}`}>
                {ix.kind === "INDEX" ? "INDEX" : ix.kind}
              </span>
              <span className="mono text-muted">({ix.columns.join(", ")})</span>
              <span className="text-muted">{oneLine(ix)}</span>
            </li>
          ))}
        </ul>
        <BTreeDiagram />
      </div>
    </details>
  );
}
