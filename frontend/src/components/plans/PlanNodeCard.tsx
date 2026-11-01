"use client";

import { InfoTip } from "../InfoTip";
import { ACCESS_META, TONE_BAR, TONE_CHIP, barPct } from "./accessTypes";
import { fmt, type FlatNode } from "./planUtils";

export function PlanNodeCard({
  flat,
  maxRows,
  selected,
  onSelect,
}: {
  flat: FlatNode;
  maxRows: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { node } = flat;
  const meta = node.access ? ACCESS_META[node.access] : null;
  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${node.op}${node.table ? ` on ${node.table}` : ""}`}
        className={`block w-full rounded-lg border-2 p-3 text-left transition-colors ${
          selected ? "border-accent bg-accent-soft" : "border-transparent bg-surface-2 hover:bg-surface-3"
        }`}
      >
        <span className="block pr-6 text-[13px] font-medium leading-tight text-ink">{node.op}</span>
        {node.table && <span className="mono mt-0.5 block text-[12px] text-muted">{node.table}</span>}
        {node.access && meta && (
          <span className="mt-2 block">
            <span className={`chip mono ${TONE_CHIP[meta.tone]}`}>{node.access}</span>
          </span>
        )}
        <span className="mt-2 block text-[12px] text-muted">~{fmt(node.rows)} rows</span>
        <span className="mt-1 block h-1.5 w-full rounded-sm bg-surface-3" aria-hidden>
          <span
            className={`block h-full rounded-sm ${meta ? TONE_BAR[meta.tone] : "bg-faint"}`}
            style={{ width: `${barPct(node.rows, maxRows)}%` }}
          />
        </span>
      </button>
      <span className="absolute right-2 top-2.5">
        <InfoTip title={node.op} align={flat.xFrac > 0.5 ? "end" : "start"} label={`Why: ${node.op}`}>
          {node.why}
          {node.access && meta ? ` Access ${node.access}: ${meta.tip}` : ""}
        </InfoTip>
      </span>
    </div>
  );
}
