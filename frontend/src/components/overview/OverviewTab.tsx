"use client";

import { useMemo, useState } from "react";
import type { TabProps } from "@/lib/types";
import { Explainer } from "../Explainer";
import { InfoTip } from "../InfoTip";
import { DbmsRoles } from "./DbmsRoles";
import { ErDiagram } from "./ErDiagram";
import { layoutEr, type ErMode, type ErSelection } from "./erLayout";
import { RulesGlance } from "./RulesGlance";
import { Section } from "./Section";
import { SelectionLine } from "./SelectionLine";
import { StatCards } from "./StatCards";

const MODES: { id: ErMode; label: string }[] = [
  { id: "keys", label: "Keys only" },
  { id: "all", label: "All columns" },
];

export function OverviewTab({ schema, live, nav }: TabProps) {
  const [mode, setMode] = useState<ErMode>("keys");
  const [selection, setSelection] = useState<ErSelection>(null);
  const [hover, setHover] = useState<ErSelection>(null);

  const layout = useMemo(() => layoutEr(schema, mode), [schema, mode]);

  return (
    <div className="space-y-6">
      <Explainer
        title="Start here: what is a DBMS?"
        tryThis="Click a line in the diagram below, then follow the four jobs of a DBMS one by one."
      >
        A database management system (DBMS) is the program that sits between your app and the data. Staffly uses MySQL, and its
        employee data is split into {schema.stats.tables} linked tables. This tour shows how MySQL stores, protects and
        searches that data.
      </Explainer>

      <DbmsRoles onGo={nav.goTo} />

      <StatCards schema={schema} live={live} />

      <Section
        id="er-diagram"
        title="Entity-relationship diagram"
        tipTitle="Reading the diagram"
        tip={
          <>
            Each line is a foreign key, from the child table to its parent. At a line end, a bar means one, a circle means zero,
            and the three-pronged foot means many. Badges mark primary (PK), foreign (FK), unique (UQ) and generated (GEN)
            columns.
          </>
        }
        right={
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Columns shown" className="inline-flex rounded-lg bg-surface-2 p-0.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={`rounded-md px-3 py-1 text-[13px] transition-colors ${
                    mode === m.id ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <InfoTip title="Keys only or all" align="end">
              Keys only shows columns that take part in keys. All columns also shows plain data columns.
            </InfoTip>
          </div>
        }
      >
        <ErDiagram
          layout={layout}
          live={live}
          selection={selection}
          hover={hover}
          onHover={setHover}
          onSelect={setSelection}
        />
        <SelectionLine schema={schema} live={live} selection={selection} nav={nav} />
      </Section>

      <RulesGlance schema={schema} nav={nav} />
    </div>
  );
}
