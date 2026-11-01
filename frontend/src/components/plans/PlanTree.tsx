"use client";

import type { PlanNode } from "@/lib/types";
import { PlanNodeCard } from "./PlanNodeCard";
import { flatten, type FlatNode } from "./planUtils";

const LINE = "bg-line-strong";

function leafCount(n: PlanNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + leafCount(c), 0);
}

interface Ctx {
  byId: Map<string, FlatNode>;
  maxRows: number;
  selectedId: string;
  onSelect: (id: string) => void;
}

/**
 * Renders a plan bottom-up: leaves (table accesses) sit at the top and feed
 * the operators below them; the root (what the client receives) is last.
 */
function Subtree({ node, id, ctx }: { node: PlanNode; id: string; ctx: Ctx }) {
  const flat = ctx.byId.get(id)!;
  const n = node.children.length;
  return (
    <div className="flex min-w-0 flex-col">
      {n > 0 && (
        <>
          <div className="flex items-stretch gap-x-3">
            {node.children.map((c, i) => (
              <div key={i} className="flex min-w-0 flex-col justify-end" style={{ flex: `${leafCount(c)} 1 0` }}>
                <Subtree node={c} id={`${id}.${i}`} ctx={ctx} />
                {/* connector: stub from the child down to the bus, bus segments toward siblings */}
                <div className="relative h-2" aria-hidden>
                  <div className={`absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 ${LINE}`} />
                  {n > 1 && (
                    <div
                      className={`absolute bottom-0 h-px ${LINE}`}
                      style={{
                        left: i === 0 ? "50%" : "-6px",
                        right: i === n - 1 ? "50%" : "-6px",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="relative h-2" aria-hidden>
            <div className={`absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 ${LINE}`} />
          </div>
        </>
      )}
      <PlanNodeCard
        flat={flat}
        maxRows={ctx.maxRows}
        selected={ctx.selectedId === id}
        onSelect={() => ctx.onSelect(id)}
      />
    </div>
  );
}

export function PlanTree({
  root,
  selectedId,
  onSelect,
}: {
  root: PlanNode;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const flat = flatten(root);
  const byId = new Map(flat.map((f) => [f.id, f]));
  const maxRows = Math.max(1, ...flat.map((f) => f.node.rows));
  return (
    <div role="group" aria-label="Query plan tree, read from top to bottom">
      <Subtree node={root} id="0" ctx={{ byId, maxRows, selectedId, onSelect }} />
    </div>
  );
}
