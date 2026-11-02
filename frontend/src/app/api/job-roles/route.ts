import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET() {
  try {
    const { rows } = await executeQuery<any[]>(
      `SELECT role_id, role_title, min_salary, max_salary FROM job_roles ORDER BY role_title`,
      [],
      'Job Role Lookup Query'
    );
    return NextResponse.json({ roles: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
