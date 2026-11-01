import { connection } from 'next/server';
import { executeQuery } from '@/lib/db';
import { loadSchema } from '@/lib/schema';
import { json, safeReason, withTimeout } from '../_lib/http';

/** Columns that must never leave the server. */
const HIDDEN = new Set(['password_hash']);
const BUDGET_MS = 4000;

/**
 * GET /api/table?name=employees: the first 5 rows of one table, read-only.
 * The table name must match the parsed schema; the column list is built from
 * the schema too, so nothing from the request is ever placed in the SQL.
 */
export async function GET(request: Request): Promise<Response> {
  await connection();

  const name = new URL(request.url).searchParams.get('name') ?? '';
  try {
    const schema = await loadSchema();
    const table = schema.tables.find((t) => t.name === name);
    if (!table) return json({ ok: false, reason: 'unknown table' }, 404);

    const columns = table.columns.map((c) => c.name).filter((c) => !HIDDEN.has(c));
    const select = columns.map((c) => `\`${c}\``).join(', ');
    const { rows } = await withTimeout(
      executeQuery<Record<string, unknown>[]>(
        `SELECT ${select} FROM \`${table.name}\` ORDER BY \`${table.primaryKey[0]}\` LIMIT 5`,
        [],
        'Primary key range read (first rows of a table)',
      ),
      BUDGET_MS,
    );
    return json({ ok: true, columns, hidden: table.columns.length - columns.length, rows });
  } catch (error) {
    return json({ ok: false, reason: safeReason(error) });
  }
}
