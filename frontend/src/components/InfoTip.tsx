"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * The "i" button used across the dashboard to explain a concept in place.
 * Opens on hover, focus or click; closes on Escape or outside click.
 *
 *   <InfoTip title="Primary key">Uniquely identifies a row...</InfoTip>
 *
 * `side` controls which edge of the button the popover opens toward.
 */
export function InfoTip({
  title,
  children,
  side = "bottom",
  align = "start",
  label,
}: {
  title?: string;
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "end";
  /** Accessible name; defaults to "More information about <title>". */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setPinned(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={root}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
    >
      <button
        type="button"
        aria-label={label ?? `More information${title ? ` about ${title}` : ""}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        className="mono inline-flex h-[16px] w-[16px] items-center justify-center rounded-full border border-line-strong text-[10px] italic leading-none text-muted transition-colors hover:border-accent hover:text-accent"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute z-50 w-72 rounded-lg border border-line-strong bg-surface-3 p-3 text-left text-[12.5px] font-normal normal-case leading-relaxed tracking-normal text-ink ${
            side === "top" ? "bottom-full mb-2" : "top-full mt-2"
          } ${align === "end" ? "right-0" : "left-0"}`}
        >
          {title && <span className="mb-1 block text-[12px] font-medium text-accent">{title}</span>}
          <span className="block text-muted [&_code]:mono [&_code]:text-ink">{children}</span>
        </span>
      )}
    </span>
  );
}
