import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET() {
  try {
    const tables = [
      'departments',
      'job_roles',
      'employees',
      'user_accounts',
      'attendance',
      'leave_requests',
      'payroll',
    ];

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const { rows } = await executeQuery<any[]>(
        `SELECT COUNT(*) AS total FROM \`${table}\``,
        [],
        `Table Cardinality Count (${table})`
      );
      counts[table] = rows[0]?.total || 0;
    }

    const { rows: versionRows } = await executeQuery<any[]>(
      `SELECT VERSION() AS version, DATABASE() AS currentDb`,
      [],
      'Server Metadata Inspection'
    );

    const { rows: sizeRows } = await executeQuery<any[]>(
      `
      SELECT
        table_name AS tableName,
        ROUND(((data_length + index_length) / 1024), 2) AS sizeKb,
        table_rows AS estRows,
        auto_increment AS nextAutoIncrement,
        engine
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY (data_length + index_length) DESC
      `,
      [],
      'Information Schema Physical Storage Inspection'
    );

    const { rows: fkRows } = await executeQuery<any[]>(
      `
      SELECT
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `,
      [],
      'Foreign Key Constraints Analysis'
    );

    return NextResponse.json({
      database: versionRows[0]?.currentDb || 'employee_management',
      version: versionRows[0]?.version || 'MySQL',
      counts,
      tables: sizeRows,
      foreignKeysCount: fkRows.length,
      foreignKeys: fkRows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching database stats' }, { status: 500 });
  }
}
