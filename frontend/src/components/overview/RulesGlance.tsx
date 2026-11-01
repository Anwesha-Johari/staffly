"use client";

import type { ReactNode } from "react";
import type { FkAction, SchemaModel, TabProps } from "@/lib/types";
import { InfoTip } from "../InfoTip";
import { readCheck } from "./checkText";
import { Section } from "./Section";

const DELETE_WORDS: Record<FkAction, string> = {
  CASCADE: "deleting the parent deletes this row too",
  "SET NULL": "deleting the parent clears the link",
  RESTRICT: "deleting the parent is blocked",
  "NO ACTION": "deleting the parent is blocked",
  "SET DEFAULT": "rejected by InnoDB",
};

function Count({
  n,
  tone,
  title,
  align,
  children,
}: {
  n: number;
  tone: string;
  title: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  if (n === 0) return <span className="chip">0</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`chip ${tone}`}>{n}</span>
      <InfoTip title={title} align={align}>
        {children}
      </InfoTip>
    </span>
  );
}

const line = "mt-1.5 block first:mt-0";

/** One compact list: per table, how many PK / FK / CHECK rules it carries. */
export function RulesGlance({ schema, nav }: { schema: SchemaModel; nav: TabProps["nav"] }) {
  const grid = "grid grid-cols-[minmax(0,1fr)_repeat(3,minmax(72px,110px))] items-center gap-x-4";
  return (
    <Section
      title="Rules at a glance"
      tipTitle="Rules"
      tip="These rules are checked by MySQL itself, so bad data is rejected before it is saved. Open an i to see the rule names."
    >
      <div className={`${grid} pb-2 text-[12px] text-faint`}>
        <span>Table</span>
        <span>PK</span>
        <span>FK</span>
        <span>CHECK</span>
      </div>
      <ul className="divide-y divide-line">
        {schema.tables.map((t) => (
          <li key={t.name} className={`${grid} py-2.5 text-[13px]`}>
            <button
              type="button"
              onClick={() => nav.openTable(t.name)}
              className="mono justify-self-start text-left text-ink hover:text-accent"
            >
              {t.name}
            </button>
            <Count n={t.primaryKey.length > 0 ? 1 : 0} tone="chip-accent" title="Primary key">
              <span className={line}>
                Made of <code>{t.primaryKey.join(", ")}</code>. Each row has a unique value here.
              </span>
            </Count>
            <Count n={t.foreignKeys.length} tone="chip-info" title="Foreign keys">
              {t.foreignKeys.map((f) => (
                <span key={f.name} className={line}>
                  <code>{f.columns.join(", ")}</code> points to <code>{f.refTable}</code>; {DELETE_WORDS[f.onDelete]}.
                </span>
              ))}
            </Count>
            <Count n={t.checks.length} tone="chip-warn" title="CHECK rules" align="end">
              {t.checks.map((c) => (
                <span key={c.name} className={line}>
                  <code>{c.name}</code>: {readCheck(c.expression, t)}
                </span>
              ))}
            </Count>
          </li>
        ))}
      </ul>
    </Section>
  );
}
