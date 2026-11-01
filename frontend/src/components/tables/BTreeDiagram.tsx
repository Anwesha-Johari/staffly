/** One static, generic B+tree: a lookup walks root -> internal -> leaf; leaves are linked. */

const LEAVES = ["1-99", "100-199", "200-299", "300-399"];
const LEAF_W = 120;
const leafX = (i: number) => 20 + i * 150;
const leafC = (i: number) => leafX(i) + LEAF_W / 2;
const INTERNAL = [
  { c: (leafC(0) + leafC(1)) / 2, text: "< 200" },
  { c: (leafC(2) + leafC(3)) / 2, text: ">= 200" },
];
const ROOT_C = (INTERNAL[0].c + INTERNAL[1].c) / 2;
const HOT_INTERNAL = 1;
const HOT_LEAF = 2;

function Box({ x, y, w, h, text, hot }: { x: number; y: number; w: number; h: number; text: string; hot?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} className={hot ? "fill-accent-soft stroke-accent" : "fill-surface-2 stroke-line-strong"} />
      <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize={12} className={`mono ${hot ? "fill-ink" : "fill-muted"}`}>
        {text}
      </text>
    </g>
  );
}

export function BTreeDiagram() {
  return (
    <figure className="m-0">
      <svg
        viewBox="0 0 600 190"
        className="h-auto w-full max-w-[560px]"
        role="img"
        aria-label="A B+tree: a root page, two internal pages and four linked leaf pages. A lookup follows one path from the root to a single leaf."
      >
        {INTERNAL.map((n, j) => (
          <line key={`r${j}`} x1={ROOT_C} y1={44} x2={n.c} y2={84} className={j === HOT_INTERNAL ? "stroke-accent" : "stroke-line-strong"} strokeWidth={j === HOT_INTERNAL ? 1.5 : 1} />
        ))}
        {LEAVES.map((_, i) => (
          <line
            key={`l${i}`}
            x1={INTERNAL[Math.floor(i / 2)].c}
            y1={124}
            x2={leafC(i)}
            y2={144}
            className={i === HOT_LEAF ? "stroke-accent" : "stroke-line-strong"}
            strokeWidth={i === HOT_LEAF ? 1.5 : 1}
          />
        ))}
        {[0, 1, 2].map((i) => (
          <line key={`s${i}`} x1={leafX(i) + LEAF_W} y1={166} x2={leafX(i + 1)} y2={166} className="stroke-faint" strokeWidth={1.5} />
        ))}
        <Box x={ROOT_C - 60} y={8} w={120} h={36} text="root" hot />
        {INTERNAL.map((n, j) => (
          <Box key={j} x={n.c - 60} y={84} w={120} h={40} text={n.text} hot={j === HOT_INTERNAL} />
        ))}
        {LEAVES.map((t, i) => (
          <Box key={t} x={leafX(i)} y={144} w={LEAF_W} h={44} text={t} hot={i === HOT_LEAF} />
        ))}
      </svg>
      <figcaption className="mt-1 text-[13px] text-muted">A lookup walks one path from root to leaf.</figcaption>
    </figure>
  );
}
