import type { TabId } from "@/lib/types";

const ROLES: { n: number; title: string; body: string; example: string; tab: TabId; cta: string }[] = [
  {
    n: 1,
    title: "It stores data",
    body: "Data lives in tables of rows and columns, saved in files on disk. Indexes let the DBMS find one row without reading them all.",
    example: "Example: one row per employee in the employees table.",
    tab: "tables",
    cta: "See the tables",
  },
  {
    n: 2,
    title: "It enforces rules",
    body: "Keys and CHECK rules are checked by the database itself, so bad data is refused no matter which app sends it.",
    example: "Example: a salary below 0, or two employees with one email, is rejected.",
    tab: "overview",
    cta: "See the rules below",
  },
  {
    n: 3,
    title: "It answers questions",
    body: "You write SQL to say what you want. The optimizer decides how to fetch it, usually through an index.",
    example: "Example: finding one employee by id is far cheaper than scanning everyone.",
    tab: "plans",
    cta: "Follow a query",
  },
  {
    n: 4,
    title: "It keeps data safe",
    body: "Transactions make a group of changes all-or-nothing, and locks stop two people from overwriting each other.",
    example: "Example: two HR users approving the same leave request.",
    tab: "transactions",
    cta: "Watch a transaction",
  },
];

/** The four jobs of a DBMS, each linked to the tab that shows it. */
export function DbmsRoles({ onGo }: { onGo: (t: TabId) => void }) {
  return (
    <section aria-label="What a DBMS does">
      <h2 className="mb-3 text-[16px] font-medium text-ink">What a DBMS does</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r.n} className="flex flex-col rounded-xl bg-surface-2 p-4">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[12px] font-medium text-accent">
              {r.n}
            </span>
            <h3 className="mt-3 text-[15px] font-medium text-ink">{r.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{r.body}</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-faint">{r.example}</p>
            <button
              type="button"
              onClick={() =>
                r.tab === "overview" ? document.getElementById("rules")?.scrollIntoView({ behavior: "smooth" }) : onGo(r.tab)
              } className="mt-auto self-start pt-3 text-[13px] text-accent hover:underline"
            >
              {r.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
