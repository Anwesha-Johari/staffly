# Staffly (frontend)

One Next.js app with two parts:

- **Employee dashboard** at `/`: add and edit employees, mark attendance, apply for and review leave, generate payroll. Needs MySQL. There is no sign-in for now.
- **Under the hood** at `/under-the-hood`: a guided tour of how a relational DBMS works, using the Staffly schema as the example. Works without a database; with one, it shows real rows, real `EXPLAIN` plans and real two-session transaction runs.

Honesty rule: anything that comes from a live database is labelled live, and anything drawn by hand or scripted (illustrative plans, scripted timelines) is labelled as such.

## Run it

```bash
npm ci
npm run dev        # http://localhost:3000
npm run lint
npm run build && npm start
```

### Database for development

From the repository root, `scripts/dev-db.sh start` creates an isolated MySQL in `.devdb/` (port 3307, user `root`, no password), loads `database/schemas.sql` and the demo data, and prints the settings. Then create `frontend/.env.local`:

```
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=employee_management
```

`scripts/dev-db.sh stop | reset | status` do what they say. To use your own MySQL instead, point the same variables at it and load `database/schemas.sql` (see `../database/README.md`). Defaults when unset: host `127.0.0.1` (not `localhost`, which can fail on Node 25 while MySQL is down), port `3306`, user `root`, empty password, database `employee_management`.

## The under-the-hood tour

Five steps, each opening with a short plain-English explanation and a "try this":

| Step | What it teaches |
| --- | --- |
| 1. How it fits together | The four jobs of a DBMS, the ER diagram, and the rules the database enforces |
| 2. Tables | Columns, types, keys, indexes, and the rows really stored |
| 3. How a query runs | One real query through parse, resolve, optimise, execute and storage, with its plan and MySQL's real `EXPLAIN` |
| 4. Transactions | Commit, rollback, row locks and deadlocks, plus a button that runs the story for real on two connections |
| 5. Live activity | The SQL statements the employee dashboard sends, translated into plain English |

## Data flow

```
database/schemas.sql
   -> src/lib/schema.ts   parses the DDL (cached with "use cache")
   -> SchemaModel         tables, columns, indexes, foreign keys, checks (src/lib/types.ts)
   -> under-the-hood/page.tsx -> Dashboard.tsx -> one tab component per step
```

Because the schema is read from the SQL file, changing a table in `database/schemas.sql` changes the diagram, tables and rules on the next load.

## Directory map

```
src/
  app/
    (app)/              employee dashboard: page.tsx (home), employees/, attendance/, leave/, payroll/
    under-the-hood/     the tour (page.tsx, layout.tsx)
    api/                live, log, explain, run, table, txdemo (see below)
  components/
    Dashboard.tsx       tour shell: step navigation, live status
    Explainer.tsx       the "what you are looking at" box at the top of each step
    InfoTip.tsx         the "i" popover
    overview/ tables/ plans/ transactions/ live/    one folder per step
    app/                shared UI of the employee dashboard (PageHeader, SqlTrace, ConfirmButton, ...)
  lib/
    schema.ts types.ts  DDL parser and shared types
    library.ts          the 18 real backend queries, with hand-written plans
    transactions.ts     scripted transaction timelines
    explainable.ts      EXPLAIN and run for library queries (read-only)
    txdemo.ts           real two-session demos on scratch tables
    explainStatement.ts SQL to plain English
    db.ts               shared mysql2 pool, statement log
    data/ validation/   queries and input rules of the employee dashboard
```

## API routes and safety

All routes call `connection()` (never prerendered) and send `Cache-Control: no-store`. None of them accepts SQL from the browser.

- `GET /api/live`: reachability, version and row counts. Never throws or hangs; failures become `connected: false`.
- `GET /api/table?name=`: first 5 rows of one table. The name must match the parsed schema; `password_hash` is never returned.
- `POST /api/explain {id}` and `POST /api/run {id}`: look the query up by id in the library, allow single `SELECT` statements only, run in a read-only transaction that is always rolled back. `run` returns at most 10 rows and hides password and hash columns.
- `POST /api/txdemo {id}`: plays a fixed two-session script (`leave-race` or `deadlock`) on a throwaway `txdemo_*` table that it creates and drops in the same request. Your real tables are never touched.
- `GET/DELETE /api/log`: the last 100 statements, in server memory only. Bound values of password-related statements are redacted.
- Write routes (`POST`, `DELETE`) refuse requests that are not same-origin.

## Employee dashboard notes

- Business rules mirror `backend/employee_backend.py`. Every write uses parameterised SQL and shows the SQL it ran in an "Under the hood" panel.
- `src/lib/session.ts` is a stub that always acts as a local admin. Sign-in was removed on purpose; add it back there when it is needed.
- Pages that depend on the current time call `await connection()` first, because Cache Components prerenders everything else.

## Design rules

White background, Space Grotesk for headings and numbers, Inter for text, Geist Mono for SQL. Soft solid tags (`.chip` classes), flat colours, no gradients, no emoji. Colours come from the tokens in `src/app/globals.css`.

This Next.js version differs from older releases. Read the guides in `node_modules/next/dist/docs/` before changing routing, caching or config (see `AGENTS.md`).

## Extending

- **New library query:** add an entry to `LIBRARY` in `src/lib/library.ts` with `id`, `sql` (using `?`), sample `params`, `tables` and a hand-written `plan`. It then appears in "How a query runs", `/api/explain` and `/api/run`.
- **New transaction story:** add a scenario to `src/lib/transactions.ts`. To make it runnable for real, add a function to `DEMOS` in `src/lib/txdemo.ts` that uses a scratch table.
- **New "i" explainer:** `<InfoTip title="...">text</InfoTip>`; keep it to a few sentences.
