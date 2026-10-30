import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

declare global {
  var _mysqlPool: Pool | undefined;
  var _queryLog: Array<{
    id: string;
    timestamp: string;
    sql: string;
    params?: any[];
    durationMs: number;
    rowCount?: number;
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SCHEMA' | 'TRANSACTION' | 'OTHER';
    concept: string;
    status: 'SUCCESS' | 'ERROR';
    error?: string;
  }> | undefined;
}

const pool =
  global._mysqlPool ||
  mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    decimalNumbers: true,
    timezone: 'Z',
  });

if (process.env.NODE_ENV !== 'production') {
  global._mysqlPool = pool;
}

if (!global._queryLog) {
  global._queryLog = [];
}

function detectOperation(sql: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SCHEMA' | 'TRANSACTION' | 'OTHER' {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT')) return 'SELECT';
  if (trimmed.startsWith('INSERT')) return 'INSERT';
  if (trimmed.startsWith('UPDATE')) return 'UPDATE';
  if (trimmed.startsWith('DELETE')) return 'DELETE';
  if (trimmed.startsWith('SHOW') || trimmed.startsWith('DESCRIBE') || trimmed.startsWith('EXPLAIN')) return 'SCHEMA';
  if (trimmed.startsWith('START') || trimmed.startsWith('COMMIT') || trimmed.startsWith('ROLLBACK')) return 'TRANSACTION';
  return 'OTHER';
}

function detectConcept(sql: string, op: string): string {
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

export async function executeQuery<T = any>(
  sql: string,
  params: any[] = [],
  conceptOverride?: string
): Promise<{ rows: T; durationMs: number; rowCount: number }> {
  const start = performance.now();
  const op = detectOperation(sql);
  const concept = conceptOverride || detectConcept(sql, op);

  try {
    const [result] = await pool.execute<any>(sql, params);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    let rowCount = 0;
    if (Array.isArray(result)) {
      rowCount = result.length;
    } else if (result && typeof result.affectedRows === 'number') {
      rowCount = result.affectedRows;
    }

    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString().substring(11, 19),
      sql: sql.replace(/\s+/g, ' ').trim(),
      params: params.length > 0 ? params : undefined,
      durationMs,
      rowCount,
      operation: op,
      concept,
      status: 'SUCCESS' as const,
    };

    if (global._queryLog) {
      global._queryLog.unshift(logEntry);
      if (global._queryLog.length > 100) {
        global._queryLog.pop();
      }
    }

    return { rows: result as T, durationMs, rowCount };
  } catch (error: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    const logEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString().substring(11, 19),
      sql: sql.replace(/\s+/g, ' ').trim(),
      params: params.length > 0 ? params : undefined,
      durationMs,
      rowCount: 0,
      operation: op,
      concept,
      status: 'ERROR' as const,
      error: error.message || 'Database error',
    };

    if (global._queryLog) {
      global._queryLog.unshift(logEntry);
      if (global._queryLog.length > 100) {
        global._queryLog.pop();
      }
    }

    throw error;
  }
}

export function getQueryLogs() {
  return global._queryLog || [];
}

export function clearQueryLogs() {
  if (global._queryLog) {
    global._queryLog = [];
  }
}

export default pool;
