"use client";

import type { ReactNode } from "react";
import type { ForeignKey, Table } from "@/lib/types";
import { InfoTip } from "../InfoTip";
import { explainCheck, fkActionText } from "./explain";

function Row({ label, tip, children }: { label: string; tip: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="inline-flex w-32 shrink-0 items-center gap-1.5 text-muted">
        {label}
        <InfoTip title={label}>{tip}</InfoTip>
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function FkChip({ fk, table, onOpenTable }: { fk: ForeignKey; table: Table; onOpenTable: (n: string) => void }) {
  const label = (
    <>
      {fk.columns.join(", ")} <span aria-hidden="true">&rarr;</span> <span className="mono">{fk.refTable}</span>
    </>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {fk.selfReference ? (
        <span className="chip chip-info">{label}</span>
      ) : (
        <button type="button" onClick={() => onOpenTable(fk.refTable)} title={`Open ${fk.refTable}`} className="chip chip-info cursor-pointer">
          {label}
        </button>
      )}
      <InfoTip title={fk.name}>
        {fk.optional ? "This link is optional." : "Every row must link to a parent row."} {fkActionText("delete", fk)}{" "}
        {fkActionText("update", { ...fk, table: table.name })}
      </InfoTip>
    </span>
  );
}

export function RulesRows({ table, onOpenTable }: { table: Table; onOpenTable: (name: string) => void }) {
  if (!table.checks.length && !table.foreignKeys.length && !table.referencedBy.length) return null;

  return (
    <div className="mt-5 grid gap-3 border-t border-line pt-5 text-[13px]">
      {table.checks.length > 0 && (
        <Row label="Checks" tip="A CHECK is a rule every new or changed row must pass, or the write fails.">
          {table.checks.map((ck) => (
            <span key={ck.name} className="inline-flex items-center gap-1">
              <span className="chip mono">{ck.name}</span>
              <InfoTip title={ck.name}>
                <code>{ck.expression}</code> {explainCheck(ck.expression).slice(0, 2).join(" ")}
              </InfoTip>
            </span>
          ))}
        </Row>
      )}
      {table.foreignKeys.length > 0 && (
        <Row label="Foreign keys" tip="A foreign key stops a row from pointing at a parent row that does not exist.">
          {table.foreignKeys.map((fk) => (
            <FkChip key={fk.name} fk={fk} table={table} onOpenTable={onOpenTable} />
          ))}
        </Row>
      )}
      {table.referencedBy.length > 0 && (
        <Row label="Referenced by" tip={`These tables hold foreign keys that point at ${table.name}. Their rules decide what a delete here does.`}>
          {table.referencedBy.map((fk) =>
            fk.table === table.name ? (
              <span key={fk.name} className="chip mono">
                {fk.table}
              </span>
            ) : (
              <button key={fk.name} type="button" onClick={() => onOpenTable(fk.table)} title={`Open ${fk.table}`} className="chip chip-info mono cursor-pointer">
                {fk.table}
              </button>
            ),
          )}
        </Row>
      )}
    </div>
  );
}
