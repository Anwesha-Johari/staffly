"use client";

import type { FkAction, SchemaModel, TabProps } from "@/lib/types";
import { readCheck } from "./checkText";
import { Section } from "./Section";

const DELETE_WORDS: Record<FkAction, string> = {
  CASCADE: "deleting the parent deletes these rows too",
  "SET NULL": "deleting the parent clears the link",
  RESTRICT: "deleting the parent is blocked",
  "NO ACTION": "deleting the parent is blocked",
  "SET DEFAULT": "rejected by InnoDB",
};

/** What the database enforces, table by table, with the real names visible. */
export function RulesGlance({ schema, nav }: { schema: SchemaModel; nav: TabProps["nav"] }) {
  return (
    <Section
      id="rules"
      title="Rules the database enforces"
      tipTitle="Constraints"
      tip="A constraint is a rule stored in the table definition. MySQL checks it on every INSERT and UPDATE, so even a buggy app cannot save bad data."
    >
      <p className="-mt-2 mb-4 text-[13.5px] text-muted">
        These are checked by MySQL on every change. Primary keys keep rows unique, foreign keys keep links valid, and CHECK
        rules keep values sensible.
      </p>
      <ul className="divide-y divide-line">
        {schema.tables.map((t) => (
          <li key={t.name} className="grid gap-x-6 gap-y-2 py-3 text-[13px] md:grid-cols-[150px_1fr]">
            <button
              type="button"
              onClick={() => nav.openTable(t.name)}
              className="mono self-start justify-self-start text-left text-[13.5px] text-ink hover:text-accent"
            >
              {t.name}
            </button>
            <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[110px_1fr]">
              <dt className="text-faint">Primary key</dt>
              <dd className="mono text-[12.5px] text-ink">{t.primaryKey.join(", ")}</dd>
              <dt className="text-faint">Links</dt>
              <dd className="text-ink">
                {t.foreignKeys.length === 0 ? (
                  <span className="text-faint">none</span>
                ) : (
                  <ul className="space-y-1">
                    {t.foreignKeys.map((f) => (
                      <li key={f.name}>
                        <span className="mono text-[12.5px]">{f.columns.join(", ")}</span> points to{" "}
                        <span className="mono text-[12.5px]">{f.refTable}</span>
                        <span className="text-muted">; {DELETE_WORDS[f.onDelete]}.</span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
              <dt className="text-faint">Checks</dt>
              <dd className="text-ink">
                {t.checks.length === 0 ? (
                  <span className="text-faint">none</span>
                ) : (
                  <ul className="space-y-1">
                    {t.checks.map((c) => (
                      <li key={c.name}>{readCheck(c.expression, t)}</li>
                    ))}
                  </ul>
                )}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </Section>
  );
}
