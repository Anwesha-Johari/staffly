"use client";

import type { LiveState, SchemaModel, TabProps } from "@/lib/types";
import { InfoTip } from "../InfoTip";
import { fkId, type ErSelection } from "./erLayout";
import { Rich } from "./Rich";
import { readRelationship } from "./relationText";

const MORE_LABELS = new Set(["Nullability", "On delete", "On update"]);

/** One short line under the diagram: what the selected table or relationship means. */
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
  let body: React.ReactNode = <span className="text-muted">Select a table or a line to read what it means.</span>;
  let actions: React.ReactNode = null;

  if (selection?.kind === "rel") {
    const fk = schema.tables.flatMap((t) => t.foreignKeys).find((f) => fkId(f) === selection.id);
    if (fk) {
      const reading = readRelationship(schema, fk);
      body = (
        <>
          <span className="chip chip-info">{reading.cardinality}</span>
          <span className="text-ink">
            <Rich text={reading.lines[0].text} />
          </span>
          <InfoTip title={fk.name} side="top" label="More about this relationship">
            {reading.lines
              .filter((l) => MORE_LABELS.has(l.label))
              .map((l) => (
                <span key={l.label} className="mt-1 block first:mt-0">
                  <Rich text={l.text} />
                </span>
              ))}
          </InfoTip>
        </>
      );
      actions = (
        <>
          <button type="button" className="btn" onClick={() => nav.openTable(fk.table)}>
            Open {fk.table}
          </button>
          {!fk.selfReference && (
            <button type="button" className="btn" onClick={() => nav.openTable(fk.refTable)}>
              Open {fk.refTable}
            </button>
          )}
        </>
      );
    }
  } else if (selection?.kind === "table") {
    const t = schema.tables.find((x) => x.name === selection.name);
    if (t) {
      const count = live?.connected ? live.rowCounts?.[t.name] : undefined;
      const names = (list: string[]) => (list.length ? list.join(", ") : "none");
      body = (
        <>
          <span className="mono text-ink">{t.name}</span>
          <span className="text-muted">{t.purpose.split(/(?<=\.)\s/)[0]}</span>
          <InfoTip title={t.name} side="top" label="More about this table">
            <span className="block">
              Primary key: <code>{t.primaryKey.join(", ") || "none"}</code>. {t.columns.length} columns
              {count === undefined ? "" : `, ${count.toLocaleString("en-IN")} rows`}.
            </span>
            <span className="mt-1 block">Points at: {names([...new Set(t.foreignKeys.map((f) => f.refTable))])}.</span>
            <span className="mt-1 block">Pointed at by: {names([...new Set(t.referencedBy.map((f) => f.table))])}.</span>
          </InfoTip>
        </>
      );
      actions = (
        <button type="button" className="btn" onClick={() => nav.openTable(t.name)}>
          Open {t.name}
        </button>
      );
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-[13px]">
      <p aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {body}
      </p>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
