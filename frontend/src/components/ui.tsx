"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, X, Info, Loader2, Inbox } from "lucide-react";

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
};
export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand-600 shadow-sm dark:text-[#0c0e17]",
    secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
    ghost: "text-muted hover:bg-surface-2 hover:text-ink",
    danger: "bg-bad-soft text-bad hover:brightness-95 border border-transparent",
    success: "bg-ok-soft text-ok hover:brightness-95 border border-transparent",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-xs gap-1.5" : "h-10 px-4 text-sm gap-2";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer whitespace-nowrap",
        v, s, className
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-2xl border border-line bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

/* ---------- Badge ---------- */
const TONES = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand",
  neutral: "bg-surface-2 text-muted",
};
export type Tone = keyof typeof TONES;
export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
const STATUS_TONE: Record<string, Tone> = {
  Active: "ok", Present: "ok", Approved: "ok", Paid: "ok",
  Pending: "warn", "Half Day": "warn", "On Leave": "warn", "On Hold": "warn",
  Inactive: "neutral", Holiday: "info", Disabled: "neutral",
  Absent: "bad", Rejected: "bad",
  Admin: "brand", HR: "info", Employee: "neutral",
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] || "neutral"}>{status}</Badge>;

/* ---------- Form fields ---------- */
const fieldBase =
  "h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-muted tracking-wide">{label}</label>
      {children(id)}
      {error ? <p className="text-xs text-bad">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
// Fields fill their container unless the caller passes an explicit width class (e.g. "w-48").
const width = (c?: string) => (c && /(^|\s)w-/.test(c) ? "" : "w-full");
export const Input = ({ className, ...p }: React.ComponentPropsWithRef<"input">) => (
  <input {...p} className={cx(fieldBase, width(className), className)} />
);
export const Select = ({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(fieldBase, width(className), "cursor-pointer pr-8", className)}>{children}</select>
);
export const Textarea = ({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(fieldBase, "w-full h-auto py-2 min-h-20 resize-y", className)} />
);

/* ---------- Avatar ---------- */
const HUES = [248, 200, 160, 20, 330, 40, 280, 180];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const h = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span
      className="inline-grid place-items-center rounded-full font-semibold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 70% 92%)`, color: `hsl(${h} 55% 32%)` }}
      aria-hidden
    >
      {ini}
    </span>
  );
}

/* ---------- Page header / states ---------- */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 anim-fade-up">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted"><Inbox className="size-5" /></span>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-bad-soft text-bad"><AlertCircle className="size-5" /></span>
      <p className="font-medium">Something went wrong</p>
      <p className="max-w-md text-sm text-muted break-words">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => <div key={j} className="skeleton h-5" />)}
        </div>
      ))}
    </div>
  );
}

/* ---------- Table ---------- */
export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>;
}
export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cx("whitespace-nowrap border-b border-line bg-surface-2/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted first:rounded-tl-xl last:rounded-tr-xl", className)}>{children}</th>
);
export const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <td className={cx("border-b border-line/70 px-4 py-3 align-middle", className)}>{children}</td>
);

/* ---------- Drawer (accessible side panel) ---------- */
export function Drawer({ open, onClose, title, subtitle, children, footer }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="anim-slide-in relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl focus:outline-none">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"><X className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, loading, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="anim-fade-up relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; kind: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<{ push: (kind: Toast["kind"], text: string) => void } | null>(null);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((i) => [...i, { id, kind, text }]);
    setTimeout(() => setItems((i) => i.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="anim-fade-up pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card">
            {t.kind === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : t.kind === "error" ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-bad" /> : <Info className="mt-0.5 size-5 shrink-0 text-info" />}
            <p className="flex-1 text-sm">{t.text}</p>
            <button onClick={() => setItems((i) => i.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="text-muted hover:text-ink cursor-pointer"><X className="size-4" /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return {
    success: (t: string) => c.push("success", t),
    error: (t: string) => c.push("error", t),
    info: (t: string) => c.push("info", t),
  };
}

/* ---------- Tabs ---------- */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-xl border border-line bg-surface-2 p-1">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all cursor-pointer",
            value === it.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          )}
        >
          {it.label}
          {it.count !== undefined && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 text-xs text-brand">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Data hook ---------- */
export function useFetch<T>(fn: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fnRef.current()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e.message || "Request failed"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function StatCard({ label, value, hint, icon, tone = "brand" }: { label: string; value: React.ReactNode; hint?: string; icon: React.ReactNode; tone?: Tone }) {
  return (
    <Card className="p-5 anim-fade-up">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={cx("grid size-9 place-items-center rounded-xl", TONES[tone])}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
