import type { ReactNode } from "react";

const STYLE = {
  info: "bg-info-soft text-info border-[var(--info-line)]",
  ok: "bg-ok-soft text-ok border-[var(--ok-line)]",
  warn: "bg-warn-soft text-warn border-[var(--warn-line)]",
  bad: "bg-bad-soft text-bad border-[var(--bad-line)]",
} as const;

/** A flat inline message. `bad` and `warn` are announced assertively. */
export function Notice({
  kind,
  children,
  className = "",
}: {
  kind: keyof typeof STYLE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={kind === "bad" || kind === "warn" ? "alert" : "status"}
      className={`rounded-[10px] border px-3.5 py-2.5 text-[13.5px] leading-relaxed ${STYLE[kind]} ${className}`}
    >
      {children}
    </div>
  );
}
