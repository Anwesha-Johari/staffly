import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

// Role-aware dashboard summary. Employees only see their own figures.
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const userRole = sp.get('userRole');
    const empId = parseInt(sp.get('userEmployeeId') || '0', 10);
    const isStaff = userRole === 'Admin' || userRole === 'HR';

    if (isStaff) {
      const [emp, dept, leave, pay, att] = await Promise.all([
        executeQuery<any[]>(
          `SELECT COUNT(*) AS total, SUM(employment_status='Active') AS active,
                  SUM(employment_status='On Leave') AS onLeave, SUM(employment_status='Inactive') AS inactive,
                  COALESCE(SUM(CASE WHEN employment_status='Active' THEN salary END),0) AS payroll
           FROM employees`, [], 'Aggregate Functions & Grouping'),
        executeQuery<any[]>(
          `SELECT d.department_name AS name, COUNT(e.employee_id) AS headcount
           FROM departments d LEFT JOIN employees e ON e.department_id = d.department_id AND e.employment_status <> 'Inactive'
           GROUP BY d.department_id, d.department_name ORDER BY headcount DESC`, [], 'GROUP BY with LEFT JOIN'),
        executeQuery<any[]>(
          `SELECT l.leave_id, CONCAT(e.first_name,' ',e.last_name) AS employee_name, l.leave_type,
                  DATE_FORMAT(l.start_date,'%Y-%m-%d') AS start_date, DATE_FORMAT(l.end_date,'%Y-%m-%d') AS end_date
           FROM leave_requests l JOIN employees e ON l.employee_id = e.employee_id
           WHERE l.leave_status='Pending' ORDER BY l.applied_at DESC LIMIT 5`, [], 'Pending Leave Queue'),
        executeQuery<any[]>(
          `SELECT payment_status AS status, COUNT(*) AS n, COALESCE(SUM(net_salary),0) AS total
           FROM payroll WHERE pay_month = DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') GROUP BY payment_status`, [], 'Aggregate Functions & Grouping'),
        executeQuery<any[]>(
          `SELECT attendance_status AS status, COUNT(*) AS n FROM attendance
           WHERE attendance_date = CURRENT_DATE GROUP BY attendance_status`, [], 'Aggregate Functions & Grouping'),
      ]);
      const pendingCount = await executeQuery<any[]>(
        `SELECT COUNT(*) AS n FROM leave_requests WHERE leave_status='Pending'`, [], 'Aggregate Functions & Grouping');
      return NextResponse.json({
        scope: 'organisation',
        employees: emp.rows[0],
        departments: dept.rows,
        pendingLeaves: leave.rows,
        pendingLeaveCount: pendingCount.rows[0].n,
        payrollThisMonth: pay.rows,
        attendanceToday: att.rows,
      });
    }

    const [att, leave, pay] = await Promise.all([
      executeQuery<any[]>(
        `SELECT attendance_status AS status, COUNT(*) AS n FROM attendance
         WHERE employee_id = ? AND DATE_FORMAT(attendance_date,'%Y-%m') = DATE_FORMAT(CURRENT_DATE,'%Y-%m')
         GROUP BY attendance_status`, [empId], 'Aggregate Functions & Grouping'),
      executeQuery<any[]>(
        `SELECT leave_status AS status, COUNT(*) AS n FROM leave_requests WHERE employee_id = ? GROUP BY leave_status`,
        [empId], 'Aggregate Functions & Grouping'),
      executeQuery<any[]>(
        `SELECT DATE_FORMAT(pay_month,'%Y-%m-%d') AS pay_month, net_salary, payment_status
         FROM payroll WHERE employee_id = ? ORDER BY pay_month DESC LIMIT 1`, [empId], 'Latest Payroll Lookup'),
    ]);
    return NextResponse.json({
      scope: 'personal',
      attendanceMonth: att.rows,
      leaveSummary: leave.rows,
      latestPayroll: pay.rows[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error building dashboard' }, { status: 500 });
  }
}
