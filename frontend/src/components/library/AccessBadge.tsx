"use client";

import type { AccessType, PlanNode } from "@/lib/types";
import { dominantAccess } from "@/lib/library";
import { ACCESS_INFO } from "./concepts";

const TONE: Record<AccessType, string> = {
  const: "chip-ok",
  eq_ref: "chip-ok",
  ref: "chip-info",
  range: "chip-info",
  index: "chip-warn",
  ALL: "chip-bad",
};

export const ACCESS_ORDER: AccessType[] = ["const", "eq_ref", "ref", "range", "index", "ALL"];

/** Tooltip body listing every access type, best to worst. */
export function AccessTypeLegend() {
  return (
    <>
      {ACCESS_ORDER.map((a) => (
        <span key={a} className="mb-1 block last:mb-0">
          <code>{a}</code>: {ACCESS_INFO[a]}
        </span>
      ))}
    </>
  );
}

/** Soft chip for the worst scan in a plan; "write" when the statement has no read access. */
export function AccessBadge({ plan }: { plan: PlanNode }) {
  const access = dominantAccess(plan);
  return access ? <span className={`chip mono ${TONE[access]}`}>{access}</span> : <span className="chip mono">write</span>;
}
