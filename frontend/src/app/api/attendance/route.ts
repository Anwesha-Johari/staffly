import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

const STATUSES = ['Present', 'Absent', 'Half Day', 'Holiday'];

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const userRole = sp.get('userRole');
    const userEmployeeId = sp.get('userEmployeeId');
    const employeeId = sp.get('employeeId');
    const month = sp.get('month'); // YYYY-MM

    let sql = `
      SELECT a.attendance_id, a.employee_id,
             CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
             DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
             TIME_FORMAT(a.check_in, '%H:%i') AS check_in,
             TIME_FORMAT(a.check_out, '%H:%i') AS check_out,
             a.attendance_status
      FROM attendance a
      JOIN employees e ON a.employee_id = e.employee_id
      WHERE 1 = 1`;
    const params: any[] = [];

    if (userRole === 'Employee') {
      sql += ` AND a.employee_id = ?`;
      params.push(parseInt(userEmployeeId || '0', 10));
    } else if (employeeId) {
      sql += ` AND a.employee_id = ?`;
      params.push(parseInt(employeeId, 10));
    }
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      sql += ` AND DATE_FORMAT(a.attendance_date, '%Y-%m') = ?`;
      params.push(month);
    }
    sql += ` ORDER BY a.attendance_date DESC, a.employee_id ASC LIMIT 500`;

    const { rows } = await executeQuery<any[]>(sql, params, 'Attendance Join Query (attendance + employees)');
    return NextResponse.json({ records: rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching attendance' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userRole, userEmployeeId, employeeId, attendanceDate, attendanceStatus, checkIn, checkOut } =
      await req.json();

    if (!['Admin', 'HR', 'Employee'].includes(userRole)) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const empId = parseInt(employeeId, 10);
    if (!empId || empId <= 0) {
      return NextResponse.json({ error: 'A valid employee is required.' }, { status: 400 });
    }
    if (userRole === 'Employee' && empId !== parseInt(userEmployeeId, 10)) {
      return NextResponse.json({ error: 'Employees can record attendance only for themselves.' }, { status: 403 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate || '')) {
      return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }
    if (!STATUSES.includes(attendanceStatus)) {
      return NextResponse.json({ error: 'Invalid attendance status.' }, { status: 400 });
    }
    const inT = checkIn || null;
    const outT = checkOut || null;
    if (inT && outT && outT < inT) {
      return NextResponse.json({ error: 'Check-out cannot be earlier than check-in.' }, { status: 400 });
    }

    const { rows: dup } = await executeQuery<any[]>(
      `SELECT attendance_id FROM attendance WHERE employee_id = ? AND attendance_date = ?`,
      [empId, attendanceDate],
      'Unique Key Check (employee_id, attendance_date)'
    );
    if (dup.length > 0) {
      return NextResponse.json({ error: 'Attendance is already recorded for this employee on that date.' }, { status: 409 });
    }

    await executeQuery(
      `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, attendance_status)
       VALUES (?, ?, ?, ?, ?)`,
      [empId, attendanceDate, inT, outT, attendanceStatus],
      'Unique Key & Constraint Enforcement'
    );
    return NextResponse.json({ success: true, message: 'Attendance recorded.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error recording attendance' }, { status: 500 });
  }
}
