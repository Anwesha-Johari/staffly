"use client";

import { useState } from "react";
import type { TabProps } from "@/lib/types";
import { Explainer } from "../Explainer";
import { InfoTip } from "../InfoTip";
import { ColumnList } from "./ColumnList";
import { DdlBlock } from "./DdlBlock";
import { IndexesBlock } from "./IndexesBlock";
import { RulesRows } from "./RulesRows";
import { SampleRows } from "./SampleRows";
import { TableRail } from "./TableRail";

export function TablesTab({ schema, live, nav, selectedTable }: TabProps) {
  const has = (name: string | null): name is string => !!name && schema.tables.some((t) => t.name === name);

  const [selected, setSelected] = useState<string | null>(has(selectedTable) ? selectedTable : (schema.tables[0]?.name ?? null));
  const [seenProp, setSeenProp] = useState<string | null>(selectedTable);

  // Follow nav.openTable when the dashboard hands us a new table (adjust state during render).
  if (seenProp !== selectedTable) {
    setSeenProp(selectedTable);
    if (has(selectedTable)) setSelected(selectedTable);
  }

  // Cross-table links go through the dashboard nav (keeps URL/state in sync) and select locally too.
  const openTable = (name: string) => {
    setSelected(name);
    nav.openTable(name);
  };

  const table = schema.tables.find((t) => t.name === selected) ?? schema.tables[0];
  if (!table) return <div className="card p-5 text-muted">The schema contains no tables.</div>;

  return (
    <div className="space-y-6">
    <Explainer
      title="Tables: where the data actually lives"
      steps={[
        "A table holds one kind of thing, like employees.",
        "Each column has a type and rules.",
        "Each row is one record.",
        "Keys link rows in different tables.",
      ]}
      tryThis="Pick employees, then follow the department_id badge to the departments table."
    >
      A relational database stores everything in tables. The primary key (PK) identifies a row, a foreign key (FK) points to a
      row in another table, and CHECK or UNIQUE rules block bad values before they are saved.
    </Explainer>
    <div className="grid items-start gap-6 [grid-template-columns:200px_minmax(0,1fr)]">
      <aside className="sticky top-4 self-start" aria-label="Table list">
        <TableRail tables={schema.tables} selected={table.name} onSelect={setSelected} />
      </aside>

      <section key={table.name} aria-labelledby="table-title" className="card min-w-0 p-5">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="table-title" className="mono text-[16px] font-medium text-ink">
            {table.name}
          </h2>
          <span className="inline-flex items-center gap-1.5">
            <span className="chip chip-accent">ENGINE={table.engine}</span>
            <InfoTip title="Storage engine" align="start">
              The engine is the part of MySQL that stores rows. InnoDB supports transactions, row-level locks and
              foreign keys.
            </InfoTip>
          </span>
        </header>
        {table.purpose && <p className="mt-1.5 text-[13.5px] text-ink">{table.purpose}</p>}
        <p className="mt-1 text-[13px] text-muted">{relations(table)}</p>

        <div className="mt-5">
          <ColumnList table={table} onOpenTable={openTable} />
        </div>

        <SampleRows table={table.name} live={live} />

        <RulesRows table={table} onOpenTable={openTable} />

        <div className="mt-5 border-t border-line">
          <IndexesBlock table={table} />
          <DdlBlock table={table} />
        </div>
      </section>
    </div>
    </div>
  );
}

function relations(t: TabProps["schema"]["tables"][number]): string {
  const to = [...new Set(t.foreignKeys.map((f) => f.refTable))];
  const from = [...new Set(t.referencedBy.map((f) => f.table))];
  const parts: string[] = [];
  if (to.length) parts.push(`It points to ${to.join(", ")}.`);
  if (from.length) parts.push(`${from.join(", ")} point${from.length === 1 ? "s" : ""} to it.`);
  return parts.join(" ") || "It does not link to any other table.";
}
