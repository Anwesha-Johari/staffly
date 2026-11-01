/**
 * Crow's-foot line-end glyphs. Geometry is relative to a port on a table edge;
 * `dir` points away from the table. Stroke colour is inherited from the parent
 * <g>, so the caller decides the state colour.
 */

/** Parent end: two bars = exactly one (mandatory); bar + circle = zero or one (optional). */
export function ParentEnd({ x, y, dir, optional }: { x: number; y: number; dir: 1 | -1; optional: boolean }) {
  const bar = (d: number) => <line x1={x + dir * d} y1={y - 6} x2={x + dir * d} y2={y + 6} />;
  return (
    <g fill="none" strokeWidth={1.5} strokeLinecap="round">
      {bar(7)}
      {optional ? (
        <circle cx={x + dir * 17} cy={y} r={4} className="fill-surface" />
      ) : (
        bar(12)
      )}
    </g>
  );
}

/** Child end: three-prong foot = many; single bar = at most one (1:1). */
export function ChildEnd({ x, y, dir, one }: { x: number; y: number; dir: 1 | -1; one: boolean }) {
  if (one) {
    return (
      <g fill="none" strokeWidth={1.5} strokeLinecap="round">
        <line x1={x + dir * 8} y1={y - 6} x2={x + dir * 8} y2={y + 6} />
      </g>
    );
  }
  const tip = x + dir * 12;
  return (
    <g fill="none" strokeWidth={1.5} strokeLinecap="round">
      <line x1={tip} y1={y} x2={x} y2={y - 6} />
      <line x1={tip} y1={y} x2={x} y2={y} />
      <line x1={tip} y1={y} x2={x} y2={y + 6} />
    </g>
  );
}
