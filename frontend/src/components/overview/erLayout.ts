import type { ForeignKey, SchemaModel, Table } from "@/lib/types";

/**
 * Pure layout computation for the ER diagram. Nothing here knows table names:
 * the hub is the most-connected table, tables it references go on the left,
 * tables that reference it go on the right, anything else drops to a band
 * underneath. Connectors are orthogonal, anchored on the actual FK / key rows.
 */

export type ErMode = "keys" | "all";
export type ErBadge = "PK" | "FK" | "UQ" | "GEN";
export type ErSelection =
  | { kind: "table"; name: string }
  | { kind: "rel"; id: string }
  | null;

export const ROW_H = 24;
export const HEAD_H = 34;
export const NODE_W = 230;
export const GUTTER = 150;
const MARGIN = 8;
const PAD_Y = 10;
const STACK_GAP = 26;
const BAND_GAP = 44;
const FOOT_H = 22;
const LANE_INSET = 46;
const LOOP_OUT = 34;

export interface Pt {
  x: number;
  y: number;
}
/** A connection point on a table edge. `dir` points away from the table. */
export interface Port extends Pt {
  dir: 1 | -1;
}

export interface ErColumn {
  name: string;
  badges: ErBadge[];
  nullable: boolean;
  /** Absolute y of the row centre. */
  y: number;
}

export interface ErNode {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  col: number;
  role: "hub" | "left" | "right" | "other";
  columns: ErColumn[];
  hiddenCount: number;
}

export interface ErEdge {
  id: string;
  fk: ForeignKey;
  child: string;
  parent: string;
  self: boolean;
  childPort: Port;
  parentPort: Port;
  path: string;
}

export interface ErLayout {
  width: number;
  height: number;
  hub: string;
  nodes: ErNode[];
  edges: ErEdge[];
}

export const fkId = (fk: ForeignKey) => `${fk.table}.${fk.name}`;

export function badgesFor(t: Table, columnName: string): ErBadge[] {
  const c = t.columns.find((x) => x.name === columnName);
  if (!c) return [];
  const out: ErBadge[] = [];
  if (c.isPrimary) out.push("PK");
  if (c.fk || t.foreignKeys.some((f) => f.columns.includes(c.name))) out.push("FK");
  if (t.indexes.some((i) => i.kind === "UNIQUE" && i.columns.includes(c.name))) out.push("UQ");
  if (c.generatedExpr) out.push("GEN");
  return out;
}

const isKeyBadge = (b: ErBadge) => b !== "GEN";
const unique = <T,>(xs: T[]) => Array.from(new Set(xs));

function buildNode(
  t: Table,
  mode: ErMode,
  x: number,
  y: number,
  col: number,
  role: ErNode["role"],
): ErNode {
  const visible = t.columns.filter((c) => mode === "all" || badgesFor(t, c.name).some(isKeyBadge));
  const hiddenCount = t.columns.length - visible.length;
  const columns: ErColumn[] = visible.map((c, i) => ({
    name: c.name,
    badges: badgesFor(t, c.name),
    nullable: c.nullable,
    y: y + HEAD_H + i * ROW_H + ROW_H / 2,
  }));
  const h = HEAD_H + visible.length * ROW_H + (hiddenCount > 0 ? FOOT_H : 8);
  return { name: t.name, x, y, w: NODE_W, h, col, role, columns, hiddenCount };
}

/** Rounded orthogonal polyline. */
function roundedPath(input: Pt[], r = 8): string {
  const pts = input.filter((p, i) => i === 0 || p.x !== input[i - 1].x || p.y !== input[i - 1].y);
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const a = pts[i - 1];
    const b = pts[i + 1];
    const la = Math.hypot(p.x - a.x, p.y - a.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const rr = Math.min(r, la / 2, lb / 2);
    if (rr < 0.5) {
      d += ` L${p.x} ${p.y}`;
      continue;
    }
    d += ` L${p.x + ((a.x - p.x) / la) * rr} ${p.y + ((a.y - p.y) / la) * rr}`;
    d += ` Q${p.x} ${p.y} ${p.x + ((b.x - p.x) / lb) * rr} ${p.y + ((b.y - p.y) / lb) * rr}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last.x} ${last.y}`;
}

interface Draft {
  fk: ForeignKey;
  child: ErNode;
  parent: ErNode;
  childPort: Port;
  parentPort: Port;
  kind: "gutter" | "bracket" | "self";
  gutter: number;
  pts: Pt[];
}

function routePts(d: Draft, xm: number): Pt[] {
  const c = d.childPort;
  const p = d.parentPort;
  if (d.kind === "gutter" && Math.abs(c.y - p.y) < 0.5) return [c, p];
  return [c, { x: xm, y: c.y }, { x: xm, y: p.y }, p];
}

function crossings(routes: Pt[][]): number {
  type Seg = { a: Pt; b: Pt };
  const segs = routes.map((pts) => {
    const out: Seg[] = [];
    for (let i = 0; i < pts.length - 1; i++) out.push({ a: pts[i], b: pts[i + 1] });
    return out;
  });
  const eps = 0.5;
  const between = (v: number, p: number, q: number) => v > Math.min(p, q) + eps && v < Math.max(p, q) - eps;
  let n = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      for (const s of segs[i]) {
        for (const t of segs[j]) {
          const sH = s.a.y === s.b.y;
          const tH = t.a.y === t.b.y;
          if (sH === tH) continue;
          const h = sH ? s : t;
          const v = sH ? t : s;
          if (between(v.a.x, h.a.x, h.b.x) && between(h.a.y, v.a.y, v.b.y)) n++;
        }
      }
    }
  }
  return n;
}

function permutations(n: number): number[][] {
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (!rest.length) return void out.push(cur);
    rest.forEach((v, i) => rec([...cur, v], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  rec([], Array.from({ length: n }, (_, i) => i));
  return out;
}

export function layoutEr(schema: SchemaModel, mode: ErMode): ErLayout {
  const tables = schema.tables;
  if (!tables.length) return { width: 400, height: 100, hub: "", nodes: [], edges: [] };

  /* ---- choose hub and sides ------------------------------------------- */
  const degree = (t: Table) =>
    new Set([
      ...t.foreignKeys.filter((f) => !f.selfReference).map((f) => f.refTable),
      ...t.referencedBy.filter((f) => !f.selfReference).map((f) => f.table),
    ]).size;
  const hub = tables.reduce((best, t) => (degree(t) > degree(best) ? t : best), tables[0]);
  const byName = new Map(tables.map((t) => [t.name, t]));
  const colPos = (name: string) => hub.columns.findIndex((c) => c.name === name);

  const leftNames = unique(
    hub.foreignKeys
      .filter((f) => !f.selfReference)
      .sort((a, b) => colPos(a.columns[0]) - colPos(b.columns[0]))
      .map((f) => f.refTable),
  );
  const rightNames = tables
    .filter((t) => t.name !== hub.name && t.foreignKeys.some((f) => f.refTable === hub.name))
    .map((t) => t.name)
    .filter((n) => !leftNames.includes(n));
  const placed = new Set([hub.name, ...leftNames, ...rightNames]);
  const otherNames = tables.map((t) => t.name).filter((n) => !placed.has(n));

  const groups: { names: string[]; role: ErNode["role"] }[] = [
    { names: leftNames, role: "left" as const },
    { names: [hub.name], role: "hub" as const },
    { names: rightNames, role: "right" as const },
  ].filter((g) => g.names.length > 0);
  const nCols = groups.length;
  const colX = (i: number) => MARGIN + i * (NODE_W + GUTTER);

  /* ---- place nodes ---------------------------------------------------- */
  // First pass to measure column heights.
  const measure = groups.map((g, ci) =>
    g.names.map((n) => buildNode(byName.get(n)!, mode, colX(ci), 0, ci, g.role)),
  );
  const colH = measure.map((ns) => ns.reduce((s, n) => s + n.h, 0) + STACK_GAP * (ns.length - 1));
  const maxH = Math.max(...colH);

  const nodes: ErNode[] = [];
  groups.forEach((g, ci) => {
    let y = PAD_Y + (maxH - colH[ci]) / 2;
    g.names.forEach((n) => {
      const node = buildNode(byName.get(n)!, mode, colX(ci), y, ci, g.role);
      nodes.push(node);
      y += node.h + STACK_GAP;
    });
  });

  let bottom = PAD_Y + maxH;
  if (otherNames.length) {
    let y = bottom + BAND_GAP;
    for (let i = 0; i < otherNames.length; i += nCols) {
      const row = otherNames.slice(i, i + nCols).map((n, k) => buildNode(byName.get(n)!, mode, colX(k), y, k, "other"));
      nodes.push(...row);
      const rowH = Math.max(...row.map((n) => n.h));
      y += rowH + STACK_GAP;
      bottom = y - STACK_GAP;
    }
  }

  const nodeBy = new Map(nodes.map((n) => [n.name, n]));
  const rowY = (n: ErNode, col: string) => n.columns.find((c) => c.name === col)?.y ?? n.y + HEAD_H / 2;

  /* ---- route edges ---------------------------------------------------- */
  const allFks = tables.flatMap((t) => t.foreignKeys);
  const drafts: Draft[] = [];
  const selfFks: ForeignKey[] = [];
  for (const fk of allFks) {
    const child = nodeBy.get(fk.table);
    const parent = nodeBy.get(fk.refTable);
    if (!child || !parent) continue;
    if (fk.selfReference || child === parent) {
      selfFks.push(fk);
      continue;
    }
    const cy = rowY(child, fk.columns[0]);
    const py = rowY(parent, fk.refColumns[0]);
    let cdir: 1 | -1;
    let pdir: 1 | -1;
    let kind: Draft["kind"] = "gutter";
    if (child.col < parent.col) {
      cdir = 1;
      pdir = -1;
    } else if (child.col > parent.col) {
      cdir = -1;
      pdir = 1;
    } else {
      kind = "bracket";
      cdir = pdir = child.col === nCols - 1 ? -1 : 1;
    }
    drafts.push({
      fk,
      child,
      parent,
      kind,
      gutter: Math.min(child.col, parent.col),
      childPort: { x: cdir > 0 ? child.x + child.w : child.x, y: cy, dir: cdir },
      parentPort: { x: pdir > 0 ? parent.x + parent.w : parent.x, y: py, dir: pdir },
      pts: [],
    });
  }

  // Lanes inside each gutter, ordered to minimise crossings.
  for (let g = 0; g < nCols - 1; g++) {
    const group = drafts.filter((d) => d.kind === "gutter" && d.gutter === g);
    if (!group.length) continue;
    group.sort((a, b) => (a.childPort.y + a.parentPort.y) - (b.childPort.y + b.parentPort.y));
    const gx0 = colX(g) + NODE_W;
    const lo = gx0 + LANE_INSET;
    const hi = gx0 + GUTTER - LANE_INSET;
    const n = group.length;
    const pitch = n > 1 ? Math.min(14, (hi - lo) / (n - 1)) : 0;
    const start = (lo + hi) / 2 - (pitch * (n - 1)) / 2;
    const laneXs = Array.from({ length: n }, (_, i) => start + i * pitch);
    const perms = n <= 6 ? permutations(n) : [Array.from({ length: n }, (_, i) => i)];
    let best = perms[0];
    let bestCost = Infinity;
    for (const perm of perms) {
      const cost = crossings(group.map((d, i) => routePts(d, laneXs[perm[i]])));
      if (cost < bestCost) {
        bestCost = cost;
        best = perm;
      }
    }
    group.forEach((d, i) => (d.pts = routePts(d, laneXs[best[i]])));
  }

  // Same-column connectors bracket around the side of the column.
  const bracketRank = new Map<number, number>();
  for (const d of drafts) {
    if (d.kind !== "bracket") continue;
    const k = bracketRank.get(d.child.col) ?? 0;
    bracketRank.set(d.child.col, k + 1);
    d.pts = routePts(d, d.childPort.x + d.childPort.dir * (30 + k * 12));
  }

  const edges: ErEdge[] = drafts.map((d) => ({
    id: fkId(d.fk),
    fk: d.fk,
    child: d.child.name,
    parent: d.parent.name,
    self: false,
    childPort: d.childPort,
    parentPort: d.parentPort,
    path: roundedPath(d.pts),
  }));

  // Self-reference loops go on the side that has no incoming connectors.
  const loopCount = new Map<string, number>();
  for (const fk of selfFks) {
    const n = nodeBy.get(fk.table)!;
    const incoming = { r: 0, l: 0 };
    for (const d of drafts) {
      if (d.parent !== n) continue;
      if (d.parentPort.dir > 0) incoming.r++;
      else incoming.l++;
    }
    let dir: 1 | -1 = incoming.r < incoming.l ? 1 : -1;
    if (nCols > 1) {
      if (n.col === 0) dir = 1;
      else if (n.col === nCols - 1) dir = -1;
    }
    const k = loopCount.get(n.name) ?? 0;
    loopCount.set(n.name, k + 1);
    const x = dir > 0 ? n.x + n.w : n.x;
    const childPort: Port = { x, y: rowY(n, fk.columns[0]), dir };
    const parentPort: Port = { x, y: rowY(n, fk.refColumns[0]), dir };
    const xm = x + dir * (LOOP_OUT + k * 12);
    edges.push({
      id: fkId(fk),
      fk,
      child: n.name,
      parent: n.name,
      self: true,
      childPort,
      parentPort,
      path: roundedPath([childPort, { x: xm, y: childPort.y }, { x: xm, y: parentPort.y }, parentPort], 10),
    });
  }

  return {
    width: MARGIN * 2 + nCols * NODE_W + (nCols - 1) * GUTTER,
    height: bottom + PAD_Y,
    hub: hub.name,
    nodes,
    edges,
  };
}
