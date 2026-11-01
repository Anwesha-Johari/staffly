import type { ReactNode } from "react";
import type { LiveState, SchemaModel } from "@/lib/types";
import { InfoTip } from "../InfoTip";

const fmt = (n: number) => n.toLocaleString("en-IN");

interface Stat {
  key: string;
  label: string;
  value: string;
  caption: string;
  tipTitle: string;
  tip: ReactNode;
}

export function StatCards({ schema, live }: { schema: SchemaModel; live: LiveState | null }) {
  const { stats, tables } = schema;
  const counts = live?.connected ? live.rowCounts : undefined;
  const rows = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const selfRefs = tables.reduce((n, t) => n + t.foreignKeys.filter((f) => f.selfReference).length, 0);
  const tablesWithPk = tables.filter((t) => t.primaryKey.length > 0).length;
  const checkTables = tables.filter((t) => t.checks.length > 0).length;

  const cards: Stat[] = [
    {
      key: "tables",
      label: "Tables",
      value: fmt(stats.tables),
      caption: `${fmt(stats.columns)} columns total`,
      tipTitle: "Table",
      tip: "A table stores rows of one kind of thing, with the same columns in every row. All of them use the InnoDB engine.",
    },
    {
      key: "rows",
      label: "Rows",
      value: rows === null ? "—" : fmt(rows),
      caption: rows === null ? "not connected" : "live count",
      tipTitle: "Row",
      tip: (
        <>
          A row is one record, such as a single employee. The total adds up an exact <code>COUNT(*)</code> per table, so it needs
          a live database.
        </>
      ),
    },
    {
      key: "pk",
      label: "Primary keys",
      value: fmt(stats.primaryKeys),
      caption: tablesWithPk === stats.tables ? "one per table" : `on ${tablesWithPk} tables`,
      tipTitle: "Primary key",
      tip: "The column that uniquely identifies each row. It can never repeat or be NULL, and InnoDB stores the table ordered by it.",
    },
    {
      key: "fk",
      label: "Foreign keys",
      value: fmt(stats.foreignKeys),
      caption: selfRefs > 0 ? `${fmt(selfRefs)} self-referencing` : "links between tables",
      tipTitle: "Foreign key",
      tip: "A column that must match a key in another table, or be NULL. This stops a row from pointing at something that does not exist.",
    },
    {
      key: "check",
      label: "CHECK rules",
      value: fmt(stats.checks),
      caption: `on ${checkTables} tables`,
      tipTitle: "CHECK constraint",
      tip: (
        <>
          A rule such as <code>salary &gt;= 0</code> that every row must pass. MySQL rejects an INSERT or UPDATE that breaks it.
        </>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, i) => (
        <div key={c.key} className="card flex flex-col gap-1.5 p-5">
          <div className="flex items-center gap-1.5 text-[12px] text-muted">
            {c.label}
            <InfoTip title={c.tipTitle} align={i >= 3 ? "end" : "start"}>
              {c.tip}
            </InfoTip>
          </div>
          <div className="num-serif text-[32px] leading-[1.1] text-ink">{c.value}</div>
          <div className="text-[12px] text-faint">{c.caption}</div>
        </div>
      ))}
    </div>
  );
}
