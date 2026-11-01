"use client";

import type { StepState } from "@/lib/transactions";

/** Small wait-for graph: arrows point from the waiter to the holder; two opposite arrows form a cycle. */
export function WaitForGraph({ state, deadlock }: { state: StepState; deadlock: boolean }) {
  const edges = state.waitFor;
  const ab = edges.some((e) => e.from === "A" && e.to === "B");
  const ba = edges.some((e) => e.from === "B" && e.to === "A");
  const colour = deadlock ? "var(--bad)" : "var(--warn)";
  const description =
    edges.length === 0
      ? "No session is waiting for another."
      : edges.map((e) => `Session ${e.from} waits for session ${e.to}`).join(". ") +
        (deadlock ? ". The arrows form a cycle: deadlock." : ".");

  return (
    <svg viewBox="0 0 240 64" role="img" aria-label={description} className="block h-auto w-full max-w-[240px]">
      <defs>
        <marker id="wf-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={colour} />
        </marker>
      </defs>
      <circle cx="30" cy="32" r="20" fill="var(--surface-2)" />
      <text x="30" y="37" textAnchor="middle" fontSize="13" fill="var(--text)">
        A
      </text>
      <circle cx="210" cy="32" r="20" fill="var(--surface-2)" />
      <text x="210" y="37" textAnchor="middle" fontSize="13" fill="var(--text)">
        B
      </text>
      {ab && <path d="M54,24 L184,24" stroke={colour} strokeWidth="1.5" fill="none" markerEnd="url(#wf-head)" />}
      {ba && <path d="M186,40 L56,40" stroke={colour} strokeWidth="1.5" fill="none" markerEnd="url(#wf-head)" />}
      {edges.length === 0 && (
        <text x="120" y="36" textAnchor="middle" fontSize="12" fill="var(--text-faint)">
          no waits
        </text>
      )}
    </svg>
  );
}
