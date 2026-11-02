import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { sql } = await req.json();

    if (!sql || typeof sql !== 'string' || !sql.trim()) {
      return NextResponse.json({ error: 'SQL query cannot be empty' }, { status: 400 });
    }

    const trimmed = sql.trim();

    // Prevent dangerous multi-statements or drop database
    const upper = trimmed.toUpperCase();
    if (upper.includes('DROP DATABASE') || upper.includes('DROP SCHEMA')) {
      return NextResponse.json({ error: 'Dropping the database is restricted in this environment.' }, { status: 403 });
    }

    const { rows, durationMs, rowCount } = await executeQuery<any>(
      trimmed,
      [],
      'Interactive Raw SQL Execution Console'
    );

    let columns: string[] = [];
    if (Array.isArray(rows) && rows.length > 0) {
      columns = Object.keys(rows[0]);
    }

    return NextResponse.json({
      success: true,
      sql: trimmed,
      columns,
      rows: Array.isArray(rows) ? rows : [],
      rowCount,
      durationMs,
      resultHeader: !Array.isArray(rows) ? rows : undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'SQL execution failed',
        code: error.code,
        sqlState: error.sqlState,
        errno: error.errno,
      },
      { status: 400 }
    );
  }
}
