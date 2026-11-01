"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DashboardNav, LiveState, SchemaModel, TabId, TabProps } from "@/lib/types";
import { InfoTip } from "./InfoTip";
import { OverviewTab } from "./overview/OverviewTab";
import { TablesTab } from "./tables/TablesTab";
import { PlansTab } from "./plans/PlansTab";
import { TransactionsTab } from "./transactions/TransactionsTab";
import { LiveTab } from "./live/LiveTab";

/** The learning path. Each step is one idea about how a DBMS works. */
const STEPS: { id: TabId; label: string; short: string }[] = [
  { id: "overview", label: "How it fits together", short: "Schema and relationships" },
  { id: "tables", label: "Tables", short: "Rows, columns and keys" },
  { id: "plans", label: "How a query runs", short: "Parse, optimise, execute" },
  { id: "transactions", label: "Transactions", short: "Commit, rollback, locks" },
  { id: "live", label: "Live activity", short: "Watch the engine work" },
];
const TAB_IDS = STEPS.map((s) => s.id);

export function Dashboard({ schema }: { schema: SchemaModel }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [live, setLive] = useState<LiveState | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  // Restore the tab from the URL hash after hydration.
  useEffect(() => {
    const h = window.location.hash.slice(1) as TabId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (TAB_IDS.includes(h)) setTab(h);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/live", { cache: "no-store" })
      .then((r) => r.json() as Promise<LiveState>)
      .then((s) => !cancelled && setLive(s))
      .catch(
        () =>
          !cancelled &&
          setLive({
            connected: false,
            database: schema.database,
            reason: "Live endpoint unreachable.",
            checkedAt: new Date().toISOString(),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [schema.database]);

  const goTo = useCallback((t: TabId) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  const nav: DashboardNav = {
    goTo,
    openTable: (name) => {
      setSelectedTable(name);
      goTo("tables");
    },
    openPlan: (id) => {
      setSelectedQueryId(id);
      goTo("plans");
    },
  };

  const props: TabProps = { schema, live, nav, selectedTable, selectedQueryId };
  const index = STEPS.findIndex((s) => s.id === tab);
  const next = STEPS[index + 1];
  const prev = STEPS[index - 1];

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pb-20 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <div>
          <h1 className="num-serif text-[24px] leading-none text-ink">Under the hood</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            A guided tour of how a database management system (DBMS) works, using the Staffly employee database.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="btn">
            Employee dashboard
          </Link>
          <ConnectionBadge live={live} schema={schema} />
        </div>
      </header>

      <nav aria-label="Learning path">
        <ol role="tablist" className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((s, i) => {
            const active = tab === s.id;
            return (
              <li key={s.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${s.id}`}
                  onClick={() => goTo(s.id)}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${
                    active ? "bg-accent-soft" : "bg-surface-2 hover:bg-surface-3"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium ${
                      active ? "bg-accent" : "bg-surface text-muted"
                    }`}
                    style={active ? { color: "var(--on-accent)" } : undefined}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-[14px] font-medium leading-tight ${active ? "text-accent" : "text-ink"}`}>
                      {s.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted">{s.short}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main id={`panel-${tab}`} role="tabpanel" className="pt-6">
        {tab === "overview" && <OverviewTab {...props} />}
        {tab === "tables" && <TablesTab {...props} />}
        {tab === "plans" && <PlansTab {...props} />}
        {tab === "transactions" && <TransactionsTab {...props} />}
        {tab === "live" && <LiveTab {...props} />}
      </main>

      <footer className="mt-10 flex items-center justify-between border-t border-line pt-5">
        {prev ? (
          <button className="btn" onClick={() => goTo(prev.id)}>
            Back: {prev.label}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button className="btn btn-primary" onClick={() => goTo(next.id)}>
            Next: {next.label}
          </button>
        ) : (
          <Link href="/" className="btn btn-primary">
            Try it in the employee dashboard
          </Link>
        )}
      </footer>
    </div>
  );
}

function ConnectionBadge({ live, schema }: { live: LiveState | null; schema: SchemaModel }) {
  const state = live === null ? "checking" : live.connected ? "live" : "static";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${state === "live" ? "bg-ok" : state === "static" ? "bg-warn" : "bg-faint"}`}
      />
      <span className="text-ink">
        {state === "live" && `Live database: ${live?.database}`}
        {state === "static" && "No database connected"}
        {state === "checking" && "Checking database"}
      </span>
      <InfoTip title="Live or static" align="end">
        {state === "live" ? (
          <>
            Connected to MySQL {live?.serverVersion}. Row counts, sample rows and real <code>EXPLAIN</code> output come from the
            running database.
          </>
        ) : (
          <>
            No MySQL server is reachable{live?.reason ? ` (${live.reason})` : ""}. Everything about the schema is read from{" "}
            <code>{schema.sourceFile}</code>, so this tour still works. Start a database (see the README) to see real rows and
            plans.
          </>
        )}
      </InfoTip>
    </div>
  );
}
