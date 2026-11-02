import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const userRole = sp.get('userRole');
    const userEmployeeId = sp.get('userEmployeeId');
    const status = sp.get('status');

    let sql = `
      SELECT l.leave_id, l.employee_id,
             CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
             l.leave_type,
             DATE_FORMAT(l.start_date, '%Y-%m-%d') AS start_date,
             DATE_FORMAT(l.end_date, '%Y-%m-%d') AS end_date,
             DATEDIFF(l.end_date, l.start_date) + 1 AS days,
             l.reason, l.leave_status,
             CONCAT(r.first_name, ' ', r.last_name) AS reviewer_name,
             DATE_FORMAT(l.applied_at, '%Y-%m-%d') AS applied_at
      FROM leave_requests l
      JOIN employees e ON l.employee_id = e.employee_id
      LEFT JOIN employees r ON l.reviewed_by = r.employee_id
      WHERE 1 = 1`;
    const params: any[] = [];

    if (userRole === 'Employee') {
      sql += ` AND l.employee_id = ?`;
      params.push(parseInt(userEmployeeId || '0', 10));
    }
    if (status && status !== 'All') {
      sql += ` AND l.leave_status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY FIELD(l.leave_status, 'Pending', 'Approved', 'Rejected'), l.start_date DESC LIMIT 300`;

    const { rows } = await executeQuery<any[]>(sql, params, 'Leave Requests Join (leave + employee + reviewer self-join)');
    return NextResponse.json({ requests: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching leave requests' }, { status: 500 });
  }
}

// Apply for leave (own record)
export async function POST(req: NextRequest) {
  try {
    const { userRole, userEmployeeId, leaveType, startDate, endDate, reason } = await req.json();
    if (!['Admin', 'HR', 'Employee'].includes(userRole)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    if (!leaveType?.trim()) return NextResponse.json({ error: 'Leave type is required.' }, { status: 400 });
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate || '') || !dateRe.test(endDate || '')) {
      return NextResponse.json({ error: 'Start and end dates are required (YYYY-MM-DD).' }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 });
    }

    const empId = parseInt(userEmployeeId, 10);
    const { rows: overlap } = await executeQuery<any[]>(
      `SELECT leave_id FROM leave_requests
       WHERE employee_id = ? AND leave_status <> 'Rejected' AND start_date <= ? AND end_date >= ?`,
      [empId, endDate, startDate],
      'Overlapping Interval Detection'
    );
    if (overlap.length > 0) {
      return NextResponse.json({ error: 'These dates overlap with an existing leave request.' }, { status: 409 });
    }

    await executeQuery(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)`,
      [empId, leaveType.trim(), startDate, endDate, reason?.trim() || null],
      'Relational Tuple Insertion with Foreign Key References'
    );
    return NextResponse.json({ success: true, message: 'Leave request submitted.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error applying for leave' }, { status: 500 });
  }
}

// Review (Admin/HR)
export async function PUT(req: NextRequest) {
  try {
    const { userRole, userEmployeeId, leaveId, decision } = await req.json();
    if (userRole !== 'Admin' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Access denied. Admin or HR role required.' }, { status: 403 });
    }
    if (!['Approved', 'Rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision.' }, { status: 400 });
    }
    const { rows } = await executeQuery<any>(
      `UPDATE leave_requests SET leave_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE leave_id = ? AND leave_status = 'Pending'`,
      [decision, parseInt(userEmployeeId, 10), parseInt(leaveId, 10)],
      'Atomic In-Place State Mutation'
    );
    if (!rows.affectedRows) {
      return NextResponse.json({ error: 'Request not found or already reviewed.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, message: `Leave request ${decision.toLowerCase()}.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error reviewing leave' }, { status: 500 });
  }
}
