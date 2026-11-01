import type { RowDataPacket } from 'mysql2/promise';
import pool, { detectOperation, recordQuery } from './db';
import { LIBRARY } from './library';
import type { LibraryQuery } from './types';

export type ExplainResult =
  | { ok: true; source: 'live'; tree: string; json: unknown; serverVersion: string }
  | { ok: false; reason: string };

const WORK_BUDGET_MS = 6000;
const STATEMENT_TIMEOUT_MS = 4000;
const SELECT_ONLY = 'EXPLAIN is only offered for SELECT statements in this dashboard';

/** Library SQL is written with Python-style %s placeholders; mysql2 wants ?. */
function toQuestionMarks(sql: string): string {
  return sql.replace(/%%/g, '\u0000').replace(/%s/g, '?').replace(/\u0000/g, '%');
}

/** Single statement that begins with SELECT; anything else is refused. */
function selectOnly(sql: string): string | null {
  const trimmed = sql.trim().replace(/;\s*$/, '');
  if (!/^select\b/i.test(trimmed)) return null;
  if (trimmed.includes(';')) return null; // no stacked statements
  return trimmed;
}

function failureReason(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'ECONNREFUSED':
      return 'connection refused';
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_DBACCESS_DENIED_ERROR':
      return 'access denied';
    case 'ER_BAD_DB_ERROR':
      return 'unknown database';
    case 'ETIMEDOUT':
    case 'PROTOCOL_SEQUENCE_TIMEOUT':
    case 'DASHBOARD_TIMEOUT':
      return 'timeout';
    default:
      return /^ER_[A-Z_]+$/.test(code) ? `MySQL error ${code}` : 'EXPLAIN could not be run against the database';
  }
}

async function runExplain(query: LibraryQuery): Promise<ExplainResult> {
  const sql = selectOnly(toQuestionMarks(query.sql));
  if (!sql) return { ok: false, reason: SELECT_ONLY };
  const params = query.params;
  if ((sql.match(/\?/g) ?? []).length !== params.length) {
    return { ok: false, reason: 'Sample parameters do not match the statement placeholders' };
  }

  let conn: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let inTx = false;
  try {
    const c = await pool.getConnection();
    conn = c;

    // `query` (client-side escaping) works for EXPLAIN where prepared statements may not.
    const run = async (text: string, values: unknown[], concept: string) => {
      const start = performance.now();
      try {
        const [rows] = await c.query<RowDataPacket[]>({ sql: text, values, timeout: STATEMENT_TIMEOUT_MS });
        recordQuery({
          sql: text,
          params: values,
          durationMs: Math.round((performance.now() - start) * 100) / 100,
          rowCount: Array.isArray(rows) ? rows.length : 0,
          operation: detectOperation(text),
          concept,
        });
        return rows;
      } catch (error) {
        recordQuery({
          sql: text,
          params: values,
          durationMs: Math.round((performance.now() - start) * 100) / 100,
          rowCount: 0,
          operation: detectOperation(text),
          concept,
          error,
        });
        throw error;
      }
    };

    // Read-only transaction: even if something unexpected slipped through, nothing can be written.
    await run('START TRANSACTION READ ONLY', [], 'Transaction Control (read-only)');
    inTx = true;

    const treeRows = await run(`EXPLAIN FORMAT=TREE ${sql}`, params, 'Query Optimizer Execution Plan');
    const jsonRows = await run(`EXPLAIN FORMAT=JSON ${sql}`, params, 'Query Optimizer Execution Plan');
    const versionRows = await run('SELECT VERSION() AS v', [], 'Server Handshake / Version Check');

    const firstCell = (rows: RowDataPacket[]): string => {
      const row = rows[0];
      return row ? String(Object.values(row)[0] ?? '') : '';
    };

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(firstCell(jsonRows));
    } catch {
      parsed = null;
    }

    return {
      ok: true,
      source: 'live',
      tree: firstCell(treeRows),
      json: parsed,
      serverVersion: String(versionRows[0]?.v ?? 'unknown'),
    };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  } finally {
    if (conn) {
      try {
        if (inTx) await conn.query('ROLLBACK');
      } catch {
        conn.destroy();
        conn = undefined;
      }
      conn?.release();
    }
  }
}

/**
 * Run EXPLAIN for a query from the built-in library. Callers pass only an id;
 * client-supplied SQL is never executed.
 */
export async function explainLibraryQuery(id: string): Promise<ExplainResult> {
  const query = LIBRARY.find((q) => q.id === id);
  if (!query) return { ok: false, reason: 'Unknown query id' };
  if (!selectOnly(toQuestionMarks(query.sql))) return { ok: false, reason: SELECT_ONLY };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ExplainResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), WORK_BUDGET_MS);
  });
  try {
    return await Promise.race([runExplain(query), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type RunResult =
  | { ok: true; columns: string[]; rows: Record<string, unknown>[]; rowCount: number; durationMs: number }
  | { ok: false; reason: string };

const MAX_RUN_ROWS = 10;

/**
 * Run a SELECT from the built-in library with its sample parameters, inside a
 * read-only transaction that is always rolled back. Only an id is accepted,
 * password_hash values are never returned, and at most 10 rows come back.
 */
export async function runLibraryQuery(id: string): Promise<RunResult> {
  const query = LIBRARY.find((q) => q.id === id);
  if (!query) return { ok: false, reason: 'Unknown query id' };
  const sql = selectOnly(toQuestionMarks(query.sql));
  if (!sql) return { ok: false, reason: 'This statement changes data, so the dashboard does not run it here' };
  if ((sql.match(/\?/g) ?? []).length !== query.params.length) {
    return { ok: false, reason: 'Sample parameters do not match the statement placeholders' };
  }

  let conn: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let inTx = false;
  try {
    const c = await pool.getConnection();
    conn = c;
    await c.query('START TRANSACTION READ ONLY');
    inTx = true;
    const start = performance.now();
    const [rows] = await c.query<RowDataPacket[]>({ sql, values: query.params, timeout: STATEMENT_TIMEOUT_MS });
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    recordQuery({
      sql,
      params: query.params,
      durationMs,
      rowCount: rows.length,
      operation: detectOperation(sql),
      concept: 'Query library: run with sample values',
    });

    const columns = rows[0] ? Object.keys(rows[0]) : [];
    const shown = rows.slice(0, MAX_RUN_ROWS).map((r) => {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(r)) out[k] = /password|hash/i.test(k) ? '[hidden]' : r[k];
      return out;
    });
    return { ok: true, columns, rows: shown, rowCount: rows.length, durationMs };
  } catch (error) {
    return { ok: false, reason: failureReason(error) };
  } finally {
    if (conn) {
      try {
        if (inTx) await conn.query('ROLLBACK');
      } catch {
        conn.destroy();
        conn = undefined;
      }
      conn?.release();
    }
  }
}
