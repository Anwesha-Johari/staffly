"use client";

import { useMemo, type KeyboardEvent } from "react";
import type { LiveState } from "@/lib/types";
import { ChildEnd, ParentEnd } from "./Markers";
import { HEAD_H, ROW_H, type ErBadge, type ErEdge, type ErLayout, type ErNode, type ErSelection } from "./erLayout";

const BADGE_W: Record<ErBadge, number> = { PK: 20, FK: 20, UQ: 22, GEN: 28 };
const BADGE_CLASS: Record<ErBadge, { box: string; text: string }> = {
  PK: { box: "fill-accent-soft", text: "fill-accent" },
  FK: { box: "fill-info-soft", text: "fill-info" },
  UQ: { box: "fill-surface-3", text: "fill-muted" },
  GEN: { box: "fill-surface-3", text: "fill-muted" },
};

const onActivate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

function Badge({ kind, x, y }: { kind: ErBadge; x: number; y: number }) {
  const w = BADGE_W[kind];
  return (
    <g>
      <rect x={x} y={y - 7} width={w} height={14} rx={7} className={BADGE_CLASS[kind].box} />
      <text
        x={x + w / 2}
        y={y}
        dy="0.35em"
        textAnchor="middle"
        fontSize={9.5}
        fontWeight={600}
        className={`${BADGE_CLASS[kind].text} select-none`}
      >
        {kind}
      </text>
    </g>
  );
}

export function ErDiagram({
  layout,
  live,
  selection,
  hover,
  onHover,
  onSelect,
}: {
  layout: ErLayout;
  live: LiveState | null;
  selection: ErSelection;
  hover: ErSelection;
  onHover: (s: ErSelection) => void;
  onSelect: (s: ErSelection) => void;
}) {
  const focus = hover ?? selection;

  const related = useMemo(() => {
    if (!focus) return null;
    const tables = new Set<string>();
    const edges = new Set<string>();
    const cols = new Map<string, Set<string>>();
    const mark = (t: string, c: string[]) => {
      const s = cols.get(t) ?? new Set<string>();
      c.forEach((x) => s.add(x));
      cols.set(t, s);
    };
    const addEdge = (e: ErEdge) => {
      edges.add(e.id);
      tables.add(e.child);
      tables.add(e.parent);
    };
    if (focus.kind === "table") {
      tables.add(focus.name);
      layout.edges.filter((e) => e.child === focus.name || e.parent === focus.name).forEach(addEdge);
    } else {
      const e = layout.edges.find((x) => x.id === focus.id);
      if (e) {
        addEdge(e);
        mark(e.child, e.fk.columns);
        mark(e.parent, e.fk.refColumns);
      }
    }
    return { tables, edges, cols };
  }, [focus, layout]);

  const rowCount = (t: string) => (live?.connected ? live.rowCounts?.[t] : undefined);

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label="Entity relationship diagram. Tab through tables and relationships; press Enter to select, Escape to clear."
      className="mx-auto block h-auto w-full max-w-[1100px]"
      onKeyDown={(e) => e.key === "Escape" && onSelect(null)}
    >
      <rect
        x={0}
        y={0}
        width={layout.width}
        height={layout.height}
        fill="transparent"
        onClick={() => onSelect(null)}
      />

      {/* Relationships */}
      {layout.edges.map((e) => {
        const isSel = selection?.kind === "rel" && selection.id === e.id;
        const isHot = !!related?.edges.has(e.id);
        const dim = !!related && !isHot;
        const tone = isSel ? "stroke-accent" : isHot ? "stroke-muted" : "stroke-faint";
        const label = `Relationship ${e.fk.name}: ${e.fk.table}.${e.fk.columns.join(", ")} references ${e.fk.refTable}.${e.fk.refColumns.join(", ")}, ${
          e.fk.oneToOne ? "one to one" : "one to many"
        }, ${e.fk.optional ? "optional" : "mandatory"}.`;
        const activate = () => onSelect({ kind: "rel", id: e.id });
        return (
          <g
            key={e.id}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={isSel}
            className={`cursor-pointer transition-opacity duration-150 ${
              dim ? "opacity-20" : "opacity-100"
            }`}
            onMouseEnter={() => onHover({ kind: "rel", id: e.id })}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover({ kind: "rel", id: e.id })}
            onBlur={() => onHover(null)}
            onClick={activate}
            onKeyDown={onActivate(activate)}
          >
            <title>{label}</title>
            <path d={e.path} fill="none" stroke="transparent" strokeWidth={14} />
            <g className={tone}>
              <path d={e.path} fill="none" strokeWidth={isSel || isHot ? 1.75 : 1.25} />
              <ParentEnd x={e.parentPort.x} y={e.parentPort.y} dir={e.parentPort.dir} optional={e.fk.optional} />
              <ChildEnd x={e.childPort.x} y={e.childPort.y} dir={e.childPort.dir} one={e.fk.oneToOne} />
            </g>
          </g>
        );
      })}

      {/* Tables */}
      {layout.nodes.map((n) => (
        <TableNode
          key={n.name}
          node={n}
          rows={rowCount(n.name)}
          selected={selection?.kind === "table" && selection.name === n.name}
          focused={focus?.kind === "table" && focus.name === n.name}
          dim={!!related && !related.tables.has(n.name)}
          hotCols={related?.cols.get(n.name)}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </svg>
  );
}

function TableNode({
  node: n,
  rows,
  selected,
  focused,
  dim,
  hotCols,
  onHover,
  onSelect,
}: {
  node: ErNode;
  rows: number | undefined;
  selected: boolean;
  focused: boolean;
  dim: boolean;
  hotCols: Set<string> | undefined;
  onHover: (s: ErSelection) => void;
  onSelect: (s: ErSelection) => void;
}) {
  const ref: ErSelection = { kind: "table", name: n.name };
  const border = selected ? "stroke-accent" : focused ? "stroke-muted" : "stroke-line-strong";
  const r = 8;
  const label = `Table ${n.name}, ${n.columns.length} column${n.columns.length === 1 ? "" : "s"} shown${
    n.hiddenCount ? `, ${n.hiddenCount} hidden` : ""
  }.`;
  const activate = () => onSelect(ref);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      className={`cursor-pointer transition-opacity duration-150 ${dim ? "opacity-25" : "opacity-100"}`}
      onMouseEnter={() => onHover(ref)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(ref)}
      onBlur={() => onHover(null)}
      onClick={activate}
      onKeyDown={onActivate(activate)}
    >
      <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={r} className="fill-surface" />
      <path
        d={`M${n.x} ${n.y + HEAD_H} V${n.y + r} Q${n.x} ${n.y} ${n.x + r} ${n.y} H${n.x + n.w - r} Q${n.x + n.w} ${n.y} ${n.x + n.w} ${n.y + r} V${n.y + HEAD_H} Z`}
        className="fill-surface-2"
      />
      <line x1={n.x} y1={n.y + HEAD_H} x2={n.x + n.w} y2={n.y + HEAD_H} strokeWidth={1} className="stroke-line-strong" />
      <text x={n.x + 12} y={n.y + HEAD_H / 2} dy="0.35em" fontSize={13} fontWeight={600} className="mono fill-ink select-none">
        {n.name}
      </text>
      {rows !== undefined && (
        <text
          x={n.x + n.w - 12}
          y={n.y + HEAD_H / 2}
          dy="0.35em"
          textAnchor="end"
          fontSize={10.5}
          className="fill-faint select-none"
        >
          {rows.toLocaleString("en-IN")} rows
        </text>
      )}

      {n.columns.map((c) => {
        let bx = n.x + n.w - 10;
        const badges: { kind: ErBadge; x: number }[] = [];
        for (const kind of [...c.badges].reverse()) {
          bx -= BADGE_W[kind];
          badges.push({ kind, x: bx });
          bx -= 4;
        }
        const hot = hotCols?.has(c.name);
        const strong = c.badges.includes("PK") || c.badges.includes("FK");
        return (
          <g key={c.name}>
            {hot && (
              <rect x={n.x + 1} y={c.y - ROW_H / 2} width={n.w - 2} height={ROW_H} className="fill-accent-soft" />
            )}
            <text
              x={n.x + 12}
              y={c.y}
              dy="0.35em"
              fontSize={12}
              className={`mono select-none ${strong ? "fill-ink" : "fill-muted"}`}
            >
              {c.name}
            </text>
            {badges.map((b) => (
              <Badge key={b.kind} kind={b.kind} x={b.x} y={c.y} />
            ))}
          </g>
        );
      })}

      {n.hiddenCount > 0 && (
        <text x={n.x + 12} y={n.y + n.h - 11} dy="0.35em" fontSize={10.5} className="fill-faint select-none">
          + {n.hiddenCount} more column{n.hiddenCount === 1 ? "" : "s"}
        </text>
      )}

      {/* Border drawn last so highlights sit on top of the header and rows. */}
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={r}
        fill="none"
        strokeWidth={selected ? 1.75 : 1}
        className={border}
      />
    </g>
  );
}
