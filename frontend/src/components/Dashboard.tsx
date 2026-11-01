"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DashboardNav, LiveState, SchemaModel, TabId, TabProps } from "@/lib/types";
import { InfoTip } from "./InfoTip";
import { OverviewTab } from "./overview/OverviewTab";
import { TablesTab } from "./tables/TablesTab";
import { LibraryTab } from "./library/LibraryTab";
import { PlansTab } from "./plans/PlansTab";
import { WhyTab } from "./why/WhyTab";
import { TransactionsTab } from "./transactions/TransactionsTab";

const TAB_IDS: TabId[] = ["overview", "tables", "library", "plans", "why", "transactions"];

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
      .catch(() =>
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

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview & ER" },
    { id: "tables", label: `${schema.stats.tables} tables` },
    { id: "library", label: "Query library" },
    { id: "plans", label: "Query plans" },
    { id: "why", label: "Why can't I...?" },
    { id: "transactions", label: "Transactions" },
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pb-20 pt-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-5">
        <div>
          <h1 className="num-serif text-[22px] leading-none text-ink">Under the hood</h1>
          <p className="mt-1 text-[12.5px] text-muted">How the database behind Staffly works.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="btn">
            Employee dashboard
          </Link>
          <ConnectionBadge live={live} schema={schema} />
        </div>
      </header>

      <nav aria-label="Sections" className="border-b border-line">
        <ul role="tablist" className="-mb-px flex flex-wrap gap-x-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <li key={t.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  onClick={() => goTo(t.id)}
                  className={`border-b-2 px-4 py-3 text-[15px] transition-colors ${
                    active
                      ? "border-accent text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <main id={`panel-${tab}`} role="tabpanel" className="pt-6">
        {tab === "overview" && <OverviewTab {...props} />}
        {tab === "tables" && <TablesTab {...props} />}
        {tab === "library" && <LibraryTab {...props} />}
        {tab === "plans" && <PlansTab {...props} />}
        {tab === "why" && <WhyTab {...props} />}
        {tab === "transactions" && <TransactionsTab {...props} />}
      </main>
    </div>
  );
}

function ConnectionBadge({ live, schema }: { live: LiveState | null; schema: SchemaModel }) {
  const state = live === null ? "checking" : live.connected ? "live" : "static";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px]">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${
          state === "live" ? "bg-ok" : state === "static" ? "bg-warn" : "bg-faint"
        }`}
      />
      <span className="text-ink">
        {state === "live" && `Live: ${live?.database}`}
        {state === "static" && "Static mode"}
        {state === "checking" && "Checking database"}
      </span>
      <span className="text-muted">
        {state === "live" && live?.serverVersion ? `MySQL ${live.serverVersion}` : `schema from ${schema.sourceFile}`}
      </span>
      <InfoTip title="Live vs static" align="end">
        {state === "live" ? (
          <>The dashboard is connected to MySQL. Row counts are exact <code>COUNT(*)</code> values and query plans come from real <code>EXPLAIN</code> output.</>
        ) : (
          <>
            No MySQL server was reachable{live?.reason ? ` (${live.reason})` : ""}. The schema, ER diagram and constraints
            are parsed from <code>{schema.sourceFile}</code>. Row counts and plans are illustrative until a database is
            connected via <code>DB_HOST</code>, <code>DB_USER</code>, <code>DB_PASSWORD</code>, <code>DB_NAME</code>.
          </>
        )}
      </InfoTip>
    </div>
  );
}
