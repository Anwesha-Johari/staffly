import type { ExecuteValues } from 'mysql2';
import { connection } from 'next/server';
import mysql, { type Pool } from 'mysql2/promise';

export type QueryOperation =
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'SCHEMA'
  | 'TRANSACTION'
  | 'OTHER';

/** One statement issued by the dashboard over the pooled connection. */
export interface QueryLogEntry {
  id: string;
  /** Wall-clock time (UTC) as HH:MM:SS. */
  timestamp: string;
  sql: string;
  params?: unknown[];
  durationMs: number;
  rowCount?: number;
  operation: QueryOperation;
  concept: string;
  status: 'SUCCESS' | 'ERROR';
  error?: string;
}

declare global {
  var _mysqlPool: Pool | undefined;
  var _queryLog: QueryLogEntry[] | undefined;
}

const MAX_LOG_ENTRIES = 100;

/**
 * mysql2 pools connect lazily, so creating one at import time never touches
 * the network and cannot fail a build.
 */
const pool: Pool =
  global._mysqlPool ||
  mysql.createPool({
    // 127.0.0.1 rather than "localhost": on Node 25 the dual-stack (::1 + 127.0.0.1) connect path
    // fails with an internal TypeError under Next.js when the server is down.
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 2500,
    decimalNumbers: true,
    timezone: 'Z',
  });

if (process.env.NODE_ENV !== 'production') {
  global._mysqlPool = pool;
}

if (!global._queryLog) {
  global._queryLog = [];
}

export function detectOperation(sql: string): QueryOperation {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) return 'SELECT';
  if (trimmed.startsWith('INSERT')) return 'INSERT';
  if (trimmed.startsWith('UPDATE')) return 'UPDATE';
  if (trimmed.startsWith('DELETE')) return 'DELETE';
  if (trimmed.startsWith('SHOW') || trimmed.startsWith('DESCRIBE') || trimmed.startsWith('EXPLAIN')) return 'SCHEMA';
  if (trimmed.startsWith('START') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) return 'TRANSACTION';
  return 'OTHER';
}

function detectConcept(sql: string, op: QueryOperation): string {
  const upper = sql.toUpperCase();
  if (upper.includes('JOIN')) return 'Relational JOIN (Foreign Key resolution)';
  if (upper.includes('GROUP BY') || upper.includes('COUNT(') || upper.includes('SUM(')) return 'Aggregate Functions & Grouping';
  if (op === 'INSERT' && (upper.includes('ATTENDANCE') || upper.includes('PAYROLL'))) return 'Unique Key & Constraint Enforcement';
  if (op === 'INSERT') return 'Relational Tuple Insertion with Primary Key Auto-Increment';
  if (op === 'UPDATE') return 'Atomic In-Place State Mutation';
  if (upper.includes('WHERE E.EMPLOYEE_ID =') || upper.includes('WHERE ACCOUNT_ID =')) return 'Indexed Primary Key Point Lookup';
  if (upper.includes('WHERE') && upper.includes('LIKE')) return 'Pattern Matching Query';
  if (op === 'SCHEMA') return 'Data Dictionary / Information Schema Inspection';
  return 'Relational Database Operation';
}

/** Append one entry to the capped, newest-first in-memory log. */
export function recordQuery(entry: {
  sql: string;
  params: unknown[];
  durationMs: number;
  rowCount: number;
  operation: QueryOperation;
  concept: string;
  error?: unknown;
}): void {
  const log = global._queryLog;
  if (!log) return;

  const failed = entry.error !== undefined;
  const message = failed
    ? (entry.error instanceof Error ? entry.error.message : String(entry.error)) || 'Database error'
    : undefined;
  const sql = entry.sql.replace(/\s+/g, ' ').trim();

  log.unshift({
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString().substring(11, 19),
    sql,
    // Never keep bound values for statements that handle credentials.
    params:
      entry.params.length === 0
        ? undefined
        : /password|passwd|hash/i.test(sql)
          ? entry.params.map(() => '[redacted]')
          : entry.params,
    durationMs: entry.durationMs,
    rowCount: failed ? 0 : entry.rowCount,
    operation: entry.operation,
    concept: entry.concept,
    status: failed ? 'ERROR' : 'SUCCESS',
    error: message?.slice(0, 300),
  });
  if (log.length > MAX_LOG_ENTRIES) {
    log.length = MAX_LOG_ENTRIES;
  }
}

export async function executeQuery<T = unknown>(
  sql: string,
  params: ExecuteValues[] = [],
  conceptOverride?: string
): Promise<{ rows: T; durationMs: number; rowCount: number }> {
  // With cacheComponents every page is prerendered first. Database access and
  // the timestamps in the statement log must only happen at request time.
  await connection();

  const start = performance.now();
  const operation = detectOperation(sql);
  const concept = conceptOverride || detectConcept(sql, operation);
  const elapsed = () => Math.round((performance.now() - start) * 100) / 100;

  try {
    const [result] = await pool.execute(sql, params);
    const durationMs = elapsed();

    let rowCount = 0;
    if (Array.isArray(result)) {
      rowCount = result.length;
    } else if (result && typeof result.affectedRows === 'number') {
      rowCount = result.affectedRows;
    }

    recordQuery({ sql, params, durationMs, rowCount, operation, concept });
    return { rows: result as T, durationMs, rowCount };
  } catch (error: unknown) {
    const normalized = normalizeError(error);
    recordQuery({ sql, params, durationMs: elapsed(), rowCount: 0, operation, concept, error: normalized });
    throw normalized;
  }
}

/**
 * When "localhost" resolves to both ::1 and 127.0.0.1, Node rejects a refused
 * connection with an AggregateError that has an empty message. Next.js dev
 * error handling trips over it (the page never finishes streaming), so callers
 * get an ordinary Error that keeps the useful `code` (e.g. ECONNREFUSED).
 */
function normalizeError(error: unknown): unknown {
  if (error instanceof AggregateError) {
    const inner = error.errors?.[0] as { code?: string; message?: string } | undefined;
    const code = (error as { code?: string }).code ?? inner?.code ?? 'ECONNREFUSED';
    const normalized = new Error(`Cannot connect to MySQL (${code})`) as Error & { code: string };
    normalized.code = code;
    return normalized;
  }
  return error;
}

export function getQueryLogs(): QueryLogEntry[] {
  return global._queryLog || [];
}

export function clearQueryLogs(): void {
  if (global._queryLog) {
    global._queryLog = [];
  }
}

export default pool;
