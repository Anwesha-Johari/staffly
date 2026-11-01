# Staffly, under the hood (frontend)

A single-page dashboard that teaches how a relational DBMS works, using the Staffly employee management schema as the example. Tabs: Overview & ER, Tables, Query library, Query plans, "Why can't I...?" and Transactions.

Honesty rule: every number or plan on screen is labelled as either live (read from a connected MySQL server) or static/illustrative (derived from `database/schemas.sql` or written by hand). With no database configured the dashboard runs in static mode and says so in the header badge.

## Stack

- Next.js 16 with `cacheComponents` and `partialPrefetching` enabled (`next.config.ts`); App Router, route handlers for the API.
- React 19, TypeScript.
- Tailwind CSS 4, wired through `@tailwindcss/turbopack` for `*.css` files (see `next.config.ts`). Tokens are declared in `src/app/globals.css`.
- `mysql2` for the optional live connection (pooled, prepared statements).
- `lucide-react` for icons.

This Next.js version has breaking changes compared with older releases. Read the relevant guide in `node_modules/next/dist/docs/` before changing routing, caching or config (see `AGENTS.md`).

## Run it

```bash
npm ci
npm run dev        # dashboard at http://localhost:3000/under-the-hood
npm run build && npm start
npm run lint
```

Live mode is optional. Copy `.env.example` to `.env.local` and set the values:

| Variable | Default when unset |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | empty |
| `DB_NAME` | `employee_management` |

Create the database first with `mysql -u root -p < ../database/schemas.sql`; optionally load demo rows with `mysql -u root -p employee_management < ../database/demo_seed.sql` (local development only, see `../database/README.md`). `.env*` files are git-ignored except `.env.example`. If the server cannot be reached within a couple of seconds, `/api/live` answers `connected: false` and the UI stays in static mode.

## Data flow

```
database/schemas.sql
   -> src/lib/schema.ts   (loadSchema: reads and parses the DDL at request time, cached with "use cache")
   -> SchemaModel         (src/lib/types.ts: tables, columns, indexes, foreign keys, checks, stats)
   -> src/app/under-the-hood/page.tsx   (server component, passes the model as a prop)
   -> Dashboard.tsx       (client component, owns the active tab, selected table/query, live state)
   -> tab components      (all receive the same TabProps: schema, live, nav, selectedTable, selectedQueryId)
```

`Dashboard` also fetches `GET /api/live` once on load and passes the result (`LiveState`) to every tab. The tab id lives in the URL hash (`#plans`). `nav.goTo`, `nav.openTable` and `nav.openPlan` let one tab link to another.

Because the schema is parsed from the SQL file rather than copied into TypeScript, changing a table in `database/schemas.sql` changes the ER diagram, table cards and constraint lists on the next load.

## Directory map

```
src/
  app/
    layout.tsx, globals.css, favicon.ico
    under-the-hood/     the dashboard route (page.tsx, layout.tsx with the dark theme wrapper)
    (app)/              main employee dashboard at / (see "Other routes in this app")
    api/
      _lib/http.ts      shared helpers: no-store JSON, same-origin check, timeout, safe error reasons
      live/route.ts     GET  connectivity, server version, exact COUNT(*) per table
      log/route.ts      GET  the in-memory log of statements this app ran; DELETE clears it
      explain/route.ts  POST EXPLAIN for one library query, looked up by id (see safety notes)
  components/
    Dashboard.tsx       header, connection badge, tab bar, tab switching
    InfoTip.tsx         the "i" popover used for in-place explanations
    QueryLog.tsx        live feed of statements issued by this app (polls /api/log)
    overview/           Overview & ER tab
    tables/             Tables tab
    library/            Query library tab
    plans/              Query plans tab (PlansTab, PlanTree, PlanNodeCard, accessTypes, planUtils)
    why/                "Why can't I...?" tab (WhyTab, SnapshotTable, info.tsx)
    transactions/       Transactions tab
  lib/
    schema.ts           DDL parser: loadSchema() -> SchemaModel
    explainable.ts      explainLibraryQuery(id): the EXPLAIN runner behind /api/explain
    library.ts          LIBRARY: the query library (SQL, sample params, illustrative plans) plus getQuery()
    violations.ts       SCENARIOS for the Why tab and resolveScenario(), which validates them against the parsed schema
    transactions.ts     scripted transaction scenarios (simulated from InnoDB's documented behaviour, not live)
    types.ts            shared, JSON-serializable types (SchemaModel, LiveState, TabProps, LibraryQuery, PlanNode, ...)
    db.ts               lazily shared mysql2 pool, executeQuery() with query logging
    auth.ts             bcryptjs helpers, currently unused (sign-in is switched off)
```

The remaining files in `src/lib` (`session.ts`, `trace.ts`, `data/`, `validation/`) and `src/components/app/` belong to the main employee dashboard, not the explainer. Run `ls -R src` to see the current file list; tab folders may hold helper modules and data files next to the `*Tab.tsx` entry point.

## API routes and safety

- `GET /api/live` never throws and never hangs: each step has a time budget and failures become `{ connected: false, reason }`. Reasons are mapped to short generic strings by `safeReason` so host names, users and passwords never reach the browser. Table names used in `COUNT(*)` come from the parsed DDL and are checked against `/^[a-z_]+$/` before being quoted.
- `GET /api/log` returns at most the last 100 statements and holds them in server memory only. `DELETE /api/log` is refused unless the request is same-origin.
- `POST /api/explain` takes `{"id": "<library query id>"}` and nothing else. The SQL is looked up server-side in the query library (an allow-list), must be a single statement starting with `SELECT`, is run with the library's sample parameters inside `START TRANSACTION READ ONLY`, and is always rolled back. Requests that are not same-origin are refused. It must never execute caller-supplied SQL; if you change this route, keep those properties. Results are labelled live; when the call fails the Query plans tab falls back to the illustrative plan.
- All routes send `Cache-Control: no-store` and call `connection()` so they are evaluated at request time, not prerendered.
- The dashboard does not write to your tables through any route listed above: `/api/live` only reads, `/api/explain` runs inside a read-only transaction, and violation scenarios are scripted and never executed.

## Design rules

- No emoji anywhere in the UI or in source strings.
- No gradients. Flat colours only; shadows are not used for decoration.
- Colours come from tokens in `src/app/globals.css` (`--bg`, `--surface`, `--text`, `--accent`, `--ok`, `--warn`, `--bad`, `--info` and their `-soft` variants), exposed to Tailwind through `@theme inline` as `bg-surface`, `text-ink`, `text-muted`, `border-line`, `text-accent` and so on. Do not hard-code hex values in components; add or reuse a token.
- Fonts are loaded in `layout.tsx` with `next/font/google` (Geist, Geist Mono, Fraunces).
- Anything not read from a live database must be labelled static or illustrative.

## Other routes in this app

The main employee dashboard lives at `/` (`src/app/(app)/`, with `src/components/app/`, `src/lib/data/`, `src/lib/validation/`): home, employees, attendance, leave and payroll. There is no sign-in for now: `src/lib/session.ts` is a stub that always acts as a local admin, so every page is open. Each page shows the SQL it ran (`SqlTrace`). The explainer lives at `/under-the-hood` and works without a database. Database access uses the `DB_*` settings; the default host is `127.0.0.1` because `localhost` can fail on Node 25 when MySQL is down.

## Extending the dashboard

### Add an InfoTip

`InfoTip` is a client component in `src/components/InfoTip.tsx`:

```tsx
import { InfoTip } from "@/components/InfoTip";

<InfoTip title="Primary key">Uniquely identifies a row. Cannot be NULL or repeat.</InfoTip>
```

Props: `title` (optional heading), `children` (the explanation, plain JSX), `side` (`"top" | "bottom"`), `align` (`"start" | "end"`, use `"end"` near the right edge) and `label` (accessible name; defaults to "More information about <title>"). Keep the text to a few sentences, name the concept, and say why it matters rather than restating the label.

### Add a library query

Library entries are typed `LibraryQuery` (`src/lib/types.ts`) and live in the `LIBRARY` array in `src/lib/library.ts`, which feeds the Query library and Query plans tabs and is the allow-list for `/api/explain`. Each entry has: `id` (unique, kebab-case; this is what `/api/explain` receives), `title`, `fn` (the Python function in `backend/employee_backend.py` that issues the statement), `category`, `sql` (copied from the backend, with parameters written as `?`), `params` (sample values, one per `?`, in order), `tables`, `concepts`, `summary`, and `plan`, a `PlanNode` tree built with the `node()` helper.

1. Copy the statement verbatim from the backend and replace `%s` with `?`.
2. Write the plan only from indexes that exist in `database/schemas.sql`. Plans are illustrations, not captured `EXPLAIN` output, and the UI labels them so; real plans come from `/api/explain` when MySQL is connected.
3. `/api/explain` only accepts a single statement that starts with `SELECT`, and the number of `?` must equal `params.length`. INSERT/UPDATE entries are fine for the library but cannot be explained live.

### Add a violation scenario ("Why can't I...?")

Scenarios live in the `SCENARIOS` array in `src/lib/violations.ts`; the tab is in `src/components/why/` (`WhyTab.tsx`, `SnapshotTable.tsx`, and `info.tsx` for the explanatory InfoTip text per constraint kind and stage). A scenario names a constraint that exists in `database/schemas.sql` through its `constraint` field (check, unique, fk, notnull or generated) and provides: `question`, the offending `sql`, `outcome` (`rejected` or `succeeds`), the `stage` at which MySQL stops it, a plain-English `why`, an `app` block describing what `backend/employee_backend.py` does with the same situation (function name, quoted line, whether Python catches it first), a `fix`, and before/after `snapshots` of example rows.

`resolveScenario` re-checks the constraint name, columns and referential action against the parsed `SchemaModel` on every render and builds the error text and DDL snippet from the schema. If the DDL no longer matches a scenario, the scenario is flagged rather than showing an invented error, so after editing `schemas.sql` open the Why tab and look for flagged entries. Example rows in `snapshots` are fabricated demo data and are labelled illustrative in the UI; scenarios are never executed against a database.
