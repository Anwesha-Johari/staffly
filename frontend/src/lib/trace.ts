import { getQueryLogs, type QueryLogEntry } from './db';

/** One statement executed through executeQuery (see src/lib/db.ts). */
export type LogEntry = QueryLogEntry;

/**
 * Run `fn` and return its result together with the SQL statements that were
 * logged while it ran, oldest first. Server actions and pages hand `sql` to
 * <SqlTrace entries={sql} /> so the user can see what the database was asked.
 *
 * It diffs the shared in-memory statement log before and after `fn()`, so
 * statements issued by other requests at the same moment can appear too;
 * the log is a teaching aid, not an audit trail. Run captured sections
 * one after another rather than in parallel to keep traces separate.
 */
export async function captureSql<T>(fn: () => Promise<T>): Promise<{ result: T; sql: LogEntry[] }> {
  const before = new Set(getQueryLogs().map((e) => e.id));
  const result = await fn();
  const sql = getQueryLogs()
    .filter((e) => !before.has(e.id))
    .reverse();
  return { result, sql };
}
