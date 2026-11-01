import { connection } from 'next/server';
import { executeQuery } from '@/lib/db';
import { loadSchema } from '@/lib/schema';
import type { LiveState } from '@/lib/types';
import { json, safeReason, withTimeout } from '../_lib/http';

const CONNECT_BUDGET_MS = 2500;
const COUNT_BUDGET_MS = 2500;
const SAFE_IDENT = /^[a-z_]+$/;

/**
 * GET /api/live: is a MySQL server reachable, and what do the tables hold?
 * Never throws and never hangs; failures degrade to `connected: false`.
 */
export async function GET(): Promise<Response> {
  await connection(); // always evaluated at request time, never prerendered

  const host = `${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'}`;
  const configured = process.env.DB_NAME || 'employee_management';
  const checkedAt = new Date().toISOString();
  let database = configured;
  let tableNames: string[] = [];

  try {
    const schema = await loadSchema();
    database = schema.database || configured;
    // Names come from the parsed DDL, never from the request; validate anyway.
    tableNames = schema.tables.map((t) => t.name).filter((n) => SAFE_IDENT.test(n));
  } catch {
    // schemas.sql unreadable: still report connectivity, just without counts.
  }

  const offline = (reason: string): Response =>
    json({ connected: false, database, reason, checkedAt } satisfies LiveState);

  let serverVersion: string;
  try {
    const { rows } = await withTimeout(
      executeQuery<Array<{ v: string }>>('SELECT VERSION() AS v', [], 'Server Handshake / Version Check'),
      CONNECT_BUDGET_MS,
    );
    serverVersion = String(rows[0]?.v ?? 'unknown');
  } catch (error) {
    return offline(safeReason(error));
  }

  const rowCounts: Record<string, number> = {};
  try {
    const settled = await withTimeout(
      Promise.allSettled(
        tableNames.map((name) =>
          executeQuery<Array<{ n: number }>>(
            // `name` is whitelisted by SAFE_IDENT above and quoted as an identifier.
            `SELECT COUNT(*) AS n FROM \`${name}\``,
            [],
            'Aggregate Functions & Grouping (exact row count)',
          ),
        ),
      ),
      COUNT_BUDGET_MS,
    );
    settled.forEach((result, i) => {
      if (result.status === 'fulfilled') rowCounts[tableNames[i]] = Number(result.value.rows[0]?.n ?? 0);
    });
  } catch {
    // counts timed out: report what we have
  }

  return json({ connected: true, database, host, serverVersion, rowCounts, checkedAt } satisfies LiveState);
}
