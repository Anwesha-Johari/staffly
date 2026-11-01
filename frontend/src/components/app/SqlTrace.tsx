import Link from "next/link";
import { InfoTip } from "@/components/InfoTip";
import type { QueryLogEntry } from "@/lib/db";

const OP_TONE: Record<string, string> = {
  SELECT: "chip-info",
  INSERT: "chip-ok",
  UPDATE: "chip-warn",
  DELETE: "chip-bad",
  TRANSACTION: "chip-accent",
};

function formatParams(params: unknown[] | undefined): string | null {
  if (!params || params.length === 0) return null;
  return params
    .map((p) => {
      if (p === null || p === undefined) return "NULL";
      if (p instanceof Date) return p.toISOString().slice(0, 10);
      if (typeof p === "string") return `'${p.length > 40 ? `${p.slice(0, 40)}...` : p}'`;
      return String(p);
    })
    .join(", ");
}

/**
 * "Under the hood: SQL for this action". A collapsed disclosure listing each
 * statement the database ran, with timing, row count and the relational
 * concept it demonstrates. Safe to render from server or client components.
 * Get entries from captureSql() in src/lib/trace.ts.
 */
export function SqlTrace({
  entries,
  title = "Under the hood: SQL for this action",
}: {
  entries: QueryLogEntry[];
  title?: string;
}) {
  if (!entries || entries.length === 0) return null;

  return (
    <details className="card-flat group mt-6">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-[13px] text-muted marker:content-none hover:text-ink">
        <span
          aria-hidden="true"
          className="inline-block text-faint transition-transform group-open:rotate-90"
        >
          &#9656;
        </span>
        <span className="font-medium text-ink">{title}</span>
        <span className="text-faint">
          {entries.length} statement{entries.length === 1 ? "" : "s"}
        </span>
      </summary>

      <p className="flex items-center gap-1.5 border-t border-line px-4 py-2 text-[12px] text-muted">
        Statements sent to MySQL, oldest first
        <InfoTip title="Under the hood">
          These are the exact statements Staffly sent to MySQL for this action. Values are passed as
          separate parameters (the <code>?</code> markers), never pasted into the SQL text, which is
          what prevents SQL injection.
        </InfoTip>
      </p>

      <ol className="divide-y divide-line border-t border-line">
        {entries.map((e) => {
          const params = formatParams(e.params);
          return (
            <li key={e.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                <span className="mono text-faint">{e.timestamp}</span>
                <span className={`chip ${OP_TONE[e.operation] ?? ""}`.trim()}>{e.operation}</span>
                <span>{e.concept}</span>
                <span className="ml-auto mono text-faint">
                  {e.durationMs} ms
                  {e.status === "SUCCESS" ? `, ${e.rowCount ?? 0} row${e.rowCount === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <pre className="mono mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface p-2.5 text-[12px] leading-relaxed text-ink">
                {e.sql}
              </pre>
              {params && (
                <p className="mono mt-1.5 break-words text-[11.5px] text-faint">params: {params}</p>
              )}
              {e.status === "ERROR" && e.error && (
                <p className="mt-1.5 text-[12px] text-bad">Failed: {e.error}</p>
              )}
            </li>
          );
        })}
      </ol>

      <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">
        Want the theory behind these?{" "}
        <Link href="/under-the-hood#plans" className="text-accent underline underline-offset-2">
          Browse the SQL library
        </Link>
        .
      </p>
    </details>
  );
}
