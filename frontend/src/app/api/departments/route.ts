import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await executeQuery<any[]>(
      `SELECT department_id, department_name, location FROM departments ORDER BY department_name`,
      [],
      'Department Lookup Query'
    );
    return NextResponse.json({ departments: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
