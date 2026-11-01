"use client";

import { useState } from "react";

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AND", "OR", "NOT", "AS",
  "ORDER", "BY", "GROUP", "HAVING", "DESC", "ASC", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "LIKE", "IN", "IS", "NULL", "LIMIT", "DISTINCT", "BETWEEN", "CASE", "WHEN", "THEN", "ELSE", "END",
]);

const FUNCTIONS = new Set([
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "CONCAT", "LOWER", "UPPER", "CURRENT_TIMESTAMP", "CURRENT_DATE", "NOW",
]);

type Kind = "keyword" | "function" | "string" | "number" | "param" | "ident" | "space" | "punct";

interface Token {
  kind: Kind;
  text: string;
  /** Zero-based index among `?` placeholders. */
  paramIndex?: number;
}

const TOKEN_RE = /'(?:[^']|'')*'|\?|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|\s+|[\s\S]/g;

export function tokenizeSql(sql: string): Token[] {
  const out: Token[] = [];
  let params = 0;
  for (const m of sql.matchAll(TOKEN_RE)) {
    const t = m[0];
    const up = t.toUpperCase();
    if (t.startsWith("'")) out.push({ kind: "string", text: t });
    else if (t === "?") out.push({ kind: "param", text: t, paramIndex: params++ });
    else if (/^\d/.test(t)) out.push({ kind: "number", text: t });
    else if (/^[A-Za-z_]/.test(t)) {
      out.push({ kind: KEYWORDS.has(up) ? "keyword" : FUNCTIONS.has(up) ? "function" : "ident", text: t });
    } else if (/^\s+$/.test(t)) out.push({ kind: "space", text: t });
    else out.push({ kind: "punct", text: t });
  }
  return out;
}

const KIND_CLASS: Record<Kind, string> = {
  keyword: "text-info",
  function: "text-warn",
  string: "text-ok",
  number: "text-warn",
  param: "rounded-sm bg-accent-soft px-[2px] text-accent",
  ident: "text-ink",
  space: "",
  punct: "text-muted",
};

function formatParam(v: string | number): string {
  return typeof v === "number" ? String(v) : `'${v}'`;
}

/** Lightly highlighted, read-only SQL block with a copy button. */
export function SqlView({
  sql,
  params,
  className = "",
}: {
  sql: string;
  params?: (string | number)[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const tokens = tokenizeSql(sql);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`rounded-lg bg-surface-2 ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <pre className="mono m-0 min-w-0 flex-1 overflow-x-auto text-[12px] leading-[1.6]">
          <code>
            {tokens.map((t, i) => (
              <span
                key={i}
                className={KIND_CLASS[t.kind]}
                title={
                  t.kind === "param" && params && t.paramIndex !== undefined && t.paramIndex < params.length
                    ? `Parameter ${t.paramIndex + 1}: ${formatParam(params[t.paramIndex])}`
                    : undefined
                }
              >
                {t.text}
              </span>
            ))}
          </code>
        </pre>
        <button type="button" onClick={copy} className="btn shrink-0 !px-2 !py-0.5 !text-[12px]">
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "SQL copied to clipboard" : ""}
        </span>
      </div>
      {params && params.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-[12px] text-muted">
          {params.map((p, i) => (
            <span key={i} className="mono">
              <span className="text-accent">?{i + 1}</span> = {formatParam(p)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
