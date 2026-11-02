import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const userRole = sp.get('userRole');
    const userEmployeeId = sp.get('userEmployeeId');
    const month = sp.get('month'); // YYYY-MM

    let sql = `
      SELECT p.payroll_id, p.employee_id,
             CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
             DATE_FORMAT(p.pay_month, '%Y-%m-%d') AS pay_month,
             p.basic_salary, p.allowances, p.deductions, p.net_salary,
             p.payment_status,
             DATE_FORMAT(p.payment_date, '%Y-%m-%d') AS payment_date
      FROM payroll p
      JOIN employees e ON p.employee_id = e.employee_id
      WHERE 1 = 1`;
    const params: any[] = [];
    if (userRole === 'Employee') {
      sql += ` AND p.employee_id = ?`;
      params.push(parseInt(userEmployeeId || '0', 10));
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      sql += ` AND DATE_FORMAT(p.pay_month, '%Y-%m') = ?`;
      params.push(month);
    }
    sql += ` ORDER BY p.pay_month DESC, p.employee_id ASC LIMIT 500`;

    const { rows } = await executeQuery<any[]>(sql, params, 'Payroll Join with Generated Column (net_salary)');
    return NextResponse.json({ records: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching payroll' }, { status: 500 });
  }
}

function money(v: any): number | null {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < 0 || n >= 100000000) return null;
  if (Math.round(n * 100) / 100 !== n) return null;
  return n;
}

// Generate payroll (Admin/HR)
export async function POST(req: NextRequest) {
  try {
    const { userRole, employeeId, payMonth, basicSalary, allowances, deductions } = await req.json();
    if (userRole !== 'Admin' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Access denied. Admin or HR role required.' }, { status: 403 });
    }
    const empId = parseInt(employeeId, 10);
    if (!empId) return NextResponse.json({ error: 'A valid employee is required.' }, { status: 400 });

    // Accept YYYY-MM and normalise to the first day of the month
    const monthStr = /^\d{4}-\d{2}$/.test(payMonth || '') ? `${payMonth}-01` : payMonth;
    if (!/^\d{4}-\d{2}-01$/.test(monthStr || '')) {
      return NextResponse.json({ error: 'Invalid payroll month.' }, { status: 400 });
    }
    const basic = money(basicSalary), allow = money(allowances), ded = money(deductions);
    if (basic === null || allow === null || ded === null) {
      return NextResponse.json({ error: 'Use non-negative amounts with at most 2 decimal places.' }, { status: 400 });
    }
    if (basic + allow < ded) {
      return NextResponse.json({ error: 'Deductions cannot exceed basic salary plus allowances.' }, { status: 400 });
    }

    const { rows: emp } = await executeQuery<any[]>(
      `SELECT employee_id FROM employees WHERE employee_id = ?`, [empId], 'Indexed Primary Key Point Lookup');
    if (emp.length === 0) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

    const { rows: dup } = await executeQuery<any[]>(
      `SELECT payroll_id FROM payroll WHERE employee_id = ? AND pay_month = ?`,
      [empId, monthStr], 'Unique Key Check (employee_id, pay_month)');
    if (dup.length > 0) {
      return NextResponse.json({ error: 'Payroll already exists for this employee and month.' }, { status: 409 });
    }

    await executeQuery(
      `INSERT INTO payroll (employee_id, pay_month, basic_salary, allowances, deductions) VALUES (?, ?, ?, ?, ?)`,
      [empId, monthStr, basic, allow, ded], 'Unique Key & Constraint Enforcement');
    return NextResponse.json({ success: true, message: 'Payroll generated.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error generating payroll' }, { status: 500 });
  }
}

// Update payment status (Admin/HR)
export async function PUT(req: NextRequest) {
  try {
    const { userRole, payrollId, status } = await req.json();
    if (userRole !== 'Admin' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Access denied. Admin or HR role required.' }, { status: 403 });
    }
    if (!['Pending', 'Paid', 'On Hold'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payment status.' }, { status: 400 });
    }
    const { rows } = await executeQuery<any>(
      `UPDATE payroll SET payment_status = ?, payment_date = ${status === 'Paid' ? 'CURRENT_DATE' : 'NULL'} WHERE payroll_id = ?`,
      [status, parseInt(payrollId, 10)], 'Atomic In-Place State Mutation');
    if (!rows.affectedRows) return NextResponse.json({ error: 'Payroll record not found.' }, { status: 404 });
    return NextResponse.json({ success: true, message: `Marked as ${status}.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating payroll' }, { status: 500 });
  }
}
