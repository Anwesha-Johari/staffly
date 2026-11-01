"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Table } from "@/lib/types";
import { buildDdl, tokenizeSql, type TokenKind } from "./ddl";
import { InfoTip } from "../InfoTip";

const TONE: Record<TokenKind, string> = {
  keyword: "text-info",
  type: "text-warn",
  string: "text-ok",
  number: "text-warn",
  func: "text-warn",
  punct: "text-faint",
  ident: "text-ink",
  space: "",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function DdlBlock({ table }: { table: Table }) {
  const ddl = useMemo(() => buildDdl(table), [table]);
  const tokens = useMemo(() => tokenizeSql(ddl), [ddl]);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = async () => {
    const ok = await copyText(ddl);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  };

  return (
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block text-faint transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
        SQL (CREATE TABLE)
        <InfoTip title="DDL">
          DDL is the SQL that defines structure instead of data. This text is rebuilt from the parsed schema of{" "}
          <code>{table.name}</code>.
        </InfoTip>
      </summary>
      <div className="mt-3 pl-4">
        <div className="mb-2 flex justify-end">
          <button type="button" className="btn" onClick={onCopy} aria-label={`Copy CREATE TABLE statement for ${table.name}`}>
            {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy SQL"}
          </button>
        </div>
        <pre className="mono m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-4 text-[13px] leading-[1.7]" tabIndex={0} aria-label={`CREATE TABLE statement for ${table.name}`}>
          <code>
            {tokens.map((t, i) =>
              t.kind === "space" ? t.text : (
                <span key={i} className={TONE[t.kind]}>
                  {t.text}
                </span>
              ),
            )}
          </code>
        </pre>
        <span className="sr-only" role="status" aria-live="polite">
          {state === "copied" ? "SQL copied to clipboard" : state === "failed" ? "Could not copy" : ""}
        </span>
      </div>
    </details>
  );
}
