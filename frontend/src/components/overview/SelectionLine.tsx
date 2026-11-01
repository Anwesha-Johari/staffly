"use client";

import type { LiveState, SchemaModel, TabProps } from "@/lib/types";
import { fkId, type ErSelection } from "./erLayout";
import { Rich } from "./Rich";
import { readRelationship } from "./relationText";

const SHOWN = new Set(["Reads as", "Reverse", "On delete", "On update"]);

/** Visible "in plain words" panel under the diagram for the selected table or relationship. */
export function SelectionLine({
  schema,
  live,
  selection,
  nav,
}: {
  schema: SchemaModel;
  live: LiveState | null;
  selection: ErSelection;
  nav: TabProps["nav"];
}) {
  let content: React.ReactNode = (
    <p className="text-[13.5px] text-muted">
      Click a table box to see what it stores, or click a line to read the relationship in plain words.
    </p>
  );

  if (selection?.kind === "rel") {
    const fk = schema.tables.flatMap((t) => t.foreignKeys).find((f) => fkId(f) === selection.id);
    if (fk) {
      const reading = readRelationship(schema, fk);
      content = (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[13px] text-ink">
              {fk.table}.{fk.columns.join(", ")} {"->"} {fk.refTable}.{fk.refColumns.join(", ")}
            </span>
            <span className="chip chip-info">{reading.cardinality}</span>
            <span className="chip">{reading.participation}</span>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-[120px_1fr]">
            {reading.lines
              .filter((l) => SHOWN.has(l.label))
              .map((l) => (
                <div key={l.label} className="contents">
                  <dt className="text-muted">{l.label}</dt>
                  <dd className="text-ink">
                    <Rich text={l.text} />
                  </dd>
                </div>
              ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => nav.openTable(fk.table)}>
              Open {fk.table}
            </button>
            {!fk.selfReference && (
              <button type="button" className="btn" onClick={() => nav.openTable(fk.refTable)}>
                Open {fk.refTable}
              </button>
            )}
          </div>
        </>
      );
    }
  } else if (selection?.kind === "table") {
    const t = schema.tables.find((x) => x.name === selection.name);
    if (t) {
      const count = live?.connected ? live.rowCounts?.[t.name] : undefined;
      const points = [...new Set(t.foreignKeys.map((f) => f.refTable))];
      const pointed = [...new Set(t.referencedBy.map((f) => f.table))];
      content = (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono text-[13.5px] text-ink">{t.name}</span>
            <span className="chip">{t.columns.length} columns</span>
            {count !== undefined && <span className="chip chip-ok">{count.toLocaleString("en-IN")} rows</span>}
          </div>
          <p className="mt-2 text-[13.5px] text-ink">{t.purpose}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-[120px_1fr]">
            <dt className="text-muted">Primary key</dt>
            <dd className="text-ink">
              <code className="mono text-[12.5px]">{t.primaryKey.join(", ")}</code>, a value no other row can share.
            </dd>
            <dt className="text-muted">Points to</dt>
            <dd className="text-ink">{points.length ? points.join(", ") : "nothing; it is a standalone lookup table"}</dd>
            <dt className="text-muted">Pointed to by</dt>
            <dd className="text-ink">{pointed.length ? pointed.join(", ") : "no other table"}</dd>
          </dl>
          <div className="mt-4">
            <button type="button" className="btn" onClick={() => nav.openTable(t.name)}>
              Open {t.name}
            </button>
          </div>
        </>
      );
    }
  }

  return (
    <div aria-live="polite" className="mt-5 rounded-xl bg-surface-2 p-4">
      <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-faint">In plain words</p>
      {content}
    </div>
  );
}
