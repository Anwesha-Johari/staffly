import type { PlanNode } from "@/lib/types";

export interface FlatNode {
  id: string;
  node: PlanNode;
  /** Horizontal centre of the node as a 0..1 fraction of the tree width. */
  xFrac: number;
}

function countLeaves(n: PlanNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
}

/** Flatten the tree (parents first); ids are "0", "0.0", "0.1", ... */
export function flatten(root: PlanNode): FlatNode[] {
  const out: FlatNode[] = [];
  const total = countLeaves(root);
  const walk = (n: PlanNode, id: string, leafStart: number) => {
    out.push({ id, node: n, xFrac: (leafStart + countLeaves(n) / 2) / total });
    let cursor = leafStart;
    n.children.forEach((c, i) => {
      walk(c, `${id}.${i}`, cursor);
      cursor += countLeaves(c);
    });
  };
  walk(root, "0", 0);
  return out;
}

export const fmt = (n: number) => n.toLocaleString("en-US");
