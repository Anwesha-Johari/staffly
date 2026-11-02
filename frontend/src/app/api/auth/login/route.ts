import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const sql = `
      SELECT
        ua.account_id,
        ua.employee_id,
        ua.username,
        ua.password_hash,
        ua.access_role,
        ua.account_status,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name
      FROM user_accounts ua
      JOIN employees e ON ua.employee_id = e.employee_id
      WHERE ua.username = ?
    `;

    const { rows } = await executeQuery<any[]>(sql, [username.trim()], 'Authentication & Password Hash Verification');

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const account = rows[0];

    const isMatch = await verifyPassword(password, account.password_hash);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (account.account_status !== 'Active') {
      return NextResponse.json({ error: 'This user account has been disabled' }, { status: 403 });
    }

    // Update last_login
    await executeQuery(
      `UPDATE user_accounts SET last_login = CURRENT_TIMESTAMP WHERE account_id = ?`,
      [account.account_id],
      'Audit Timestamp Update'
    );

    return NextResponse.json({
      user: {
        accountId: account.account_id,
        employeeId: account.employee_id,
        username: account.username,
        accessRole: account.access_role,
        employeeName: account.employee_name,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Authentication error' }, { status: 500 });
  }
}

// GET lists available user accounts for the demo switcher
export async function GET() {
  try {
    const sql = `
      SELECT
        ua.account_id,
        ua.employee_id,
        ua.username,
        ua.access_role,
        ua.account_status,
        CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
        d.department_name,
        j.role_title
      FROM user_accounts ua
      JOIN employees e ON ua.employee_id = e.employee_id
      LEFT JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN job_roles j ON e.role_id = j.role_id
      WHERE ua.account_status = 'Active'
      ORDER BY FIELD(ua.access_role, 'Admin', 'HR', 'Employee'), ua.account_id
    `;

    const { rows } = await executeQuery<any[]>(sql, [], 'Fetch Available Accounts for RBAC Demonstration');

    const accounts = rows.map((r) => ({
      accountId: r.account_id,
      employeeId: r.employee_id,
      username: r.username,
      accessRole: r.access_role,
      employeeName: r.employee_name,
      departmentName: r.department_name,
      roleTitle: r.role_title,
    }));

    return NextResponse.json({ accounts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching demo accounts' }, { status: 500 });
  }
}
