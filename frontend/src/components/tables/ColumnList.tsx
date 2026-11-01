"use client";

import type { Column, Table } from "@/lib/types";
import { InfoTip } from "../InfoTip";
import { stripOuterParens } from "./explain";

function Chips({ table, col, onOpenTable }: { table: Table; col: Column; onOpenTable: (n: string) => void }) {
  const fk = table.foreignKeys.find((f) => f.columns.includes(col.name));
  const composite = table.indexes.find((ix) => ix.kind === "UNIQUE" && ix.columns.length > 1 && ix.columns.includes(col.name));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {col.isPrimary && <span className="chip chip-accent">PK</span>}
      {fk &&
        (fk.selfReference ? (
          <span className="chip chip-info">FK</span>
        ) : (
          <button
            type="button"
            onClick={() => onOpenTable(fk.refTable)}
            title={`References ${fk.refTable}. Click to open it.`}
            className="chip chip-info cursor-pointer"
          >
            FK <span aria-hidden="true">&rarr;</span> <span className="mono">{fk.refTable}</span>
          </button>
        ))}
      {(col.isUnique || composite) && (
        <span className="chip chip-info" title={composite && !col.isUnique ? `Unique together with the other columns of ${composite.name}` : undefined}>
          UNIQUE
        </span>
      )}
      {!col.nullable && !col.isPrimary && <span className="chip">NOT NULL</span>}
      {col.autoIncrement && <span className="chip">AUTO</span>}
      {col.generatedExpr && (
        <span className="chip chip-warn" title={`= ${stripOuterParens(col.generatedExpr)}`}>
          GENERATED
        </span>
      )}
    </div>
  );
}

export function ColumnList({ table, onOpenTable }: { table: Table; onOpenTable: (name: string) => void }) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-[13px]">
      <colgroup>
        <col style={{ width: "30%" }} />
        <col style={{ width: "22%" }} />
        <col />
      </colgroup>
      <thead>
        <tr className="border-b border-line text-muted">
          <th scope="col" className="py-2 pr-3 font-normal">
            Column
          </th>
          <th scope="col" className="py-2 pr-3 font-normal">
            Type
          </th>
          <th scope="col" className="py-2 font-normal">
            <span className="inline-flex items-center gap-1.5">
              Badges
              <InfoTip title="Badges" align="start">
                PK identifies a row; FK points to a row in another table; UNIQUE blocks duplicates. NOT NULL needs a
                value, AUTO counts up by itself, and GENERATED is computed from other columns.
              </InfoTip>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {table.columns.map((c) => (
          <tr key={c.name} className="border-b border-line align-top last:border-b-0">
            <th scope="row" className="mono break-words py-2.5 pr-3 font-medium text-ink">
              {c.name}
            </th>
            <td className="mono break-words py-2.5 pr-3 text-muted">{c.type}</td>
            <td className="py-2.5">
              <Chips table={table} col={c} onOpenTable={onOpenTable} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
