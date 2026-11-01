import Link from "next/link";

/**
 * Shown when a page cannot reach MySQL. Calm and actionable: names the
 * environment variables, how to start the database and where the schema is,
 * and points at /under-the-hood, which works without a database.
 */
export function DbUnavailable({ error }: { error?: unknown }) {
  const detail =
    process.env.NODE_ENV !== "production" && error
      ? (error instanceof Error ? error.message : String(error)).slice(0, 240)
      : null;

  return (
    <section className="card p-6" aria-labelledby="db-unavailable-title">
      <h2 id="db-unavailable-title" className="text-[18px] font-medium text-ink">
        The database is not reachable
      </h2>
      <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
        Staffly could not open a connection to MySQL, so this page has nothing to show yet. Nothing is
        wrong with your data; the page will work as soon as the connection does.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[12.5px] font-medium text-ink">1. Check the connection settings</p>
          <p className="mt-1 text-[13px] text-muted">
            Set these in <code className="mono text-ink">frontend/.env.local</code> (see{" "}
            <code className="mono text-ink">.env.example</code>):
          </p>
          <pre className="card-flat mono mt-2 overflow-x-auto p-3 text-[12px] leading-relaxed text-ink">
{`DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=employee_management`}
          </pre>
        </div>
        <div>
          <p className="text-[12.5px] font-medium text-ink">2. Start MySQL and load the schema</p>
          <pre className="card-flat mono mt-2 overflow-x-auto p-3 text-[12px] leading-relaxed text-ink">
{`# macOS (Homebrew)
brew services start mysql

# then, from the repository root
mysql -u root -p < database/schemas.sql`}
          </pre>
        </div>
      </div>

      {detail && (
        <details className="mt-5 text-[12.5px] text-muted">
          <summary className="cursor-pointer select-none">Technical detail</summary>
          <p className="mono mt-2 break-words text-faint">{detail}</p>
        </details>
      )}

      <p className="mt-5 text-[13px] text-muted">
        Want to see how the database works without one?{" "}
        <Link href="/under-the-hood" className="text-accent underline underline-offset-2">
          Open the under-the-hood explainer
        </Link>
        , which runs without MySQL.
      </p>
    </section>
  );
}
