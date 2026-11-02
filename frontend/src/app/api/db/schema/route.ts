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

    const schemaDetails: Record<string, any> = {};

    for (const table of tables) {
      const { rows: columns } = await executeQuery<any[]>(
        `
        SELECT
          COLUMN_NAME AS name,
          COLUMN_TYPE AS type,
          IS_NULLABLE AS isNullable,
          COLUMN_KEY AS columnKey,
          COLUMN_DEFAULT AS defaultValue,
          EXTRA AS extra
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
        `,
        [table],
        `Column Dictionary Inspection (${table})`
      );

      const { rows: keys } = await executeQuery<any[]>(
        `SHOW KEYS FROM \`${table}\``,
        [],
        `Index & Constraint Inspection (${table})`
      );

      schemaDetails[table] = {
        name: table,
        columns,
        indexes: keys,
      };
    }

    const { rows: relationships } = await executeQuery<any[]>(
      `
      SELECT
        kcu.CONSTRAINT_NAME AS constraintName,
        kcu.TABLE_NAME AS fromTable,
        kcu.COLUMN_NAME AS fromColumn,
        kcu.REFERENCED_TABLE_NAME AS toTable,
        kcu.REFERENCED_COLUMN_NAME AS toColumn,
        rc.UPDATE_RULE AS onUpdate,
        rc.DELETE_RULE AS onDelete
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      `,
      [],
      'Relational Schema Foreign Key Topology'
    );

    return NextResponse.json({
      tables: schemaDetails,
      relationships,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching schema' }, { status: 500 });
  }
}
