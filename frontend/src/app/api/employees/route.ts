import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status')?.trim();
    const userRole = searchParams.get('userRole');
    const userEmployeeId = searchParams.get('userEmployeeId');

    let query = `
      SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.phone,
        DATE_FORMAT(e.hire_date, '%Y-%m-%d') AS hire_date,
        e.salary,
        e.department_id,
        d.department_name,
        e.role_id,
        j.role_title,
        e.manager_id,
        CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
        e.employment_status,
        e.created_at
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN job_roles j ON e.role_id = j.role_id
      LEFT JOIN employees m ON e.manager_id = m.employee_id
      WHERE 1 = 1
    `;

    const params: any[] = [];

    // RBAC: If Employee role, restrict to own record
    if (userRole === 'Employee' && userEmployeeId) {
      query += ` AND e.employee_id = ?`;
      params.push(parseInt(userEmployeeId, 10));
    } else {
      if (status && status !== 'All') {
        query += ` AND e.employment_status = ?`;
        params.push(status);
      }

      if (search) {
        if (/^\d+$/.test(search)) {
          query += ` AND e.employee_id = ?`;
          params.push(parseInt(search, 10));
        } else if (search.includes('@')) {
          query += ` AND LOWER(e.email) = LOWER(?)`;
          params.push(search);
        } else {
          query += ` AND (CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR e.first_name LIKE ? OR e.last_name LIKE ?)`;
          const pattern = `%${search}%`;
          params.push(pattern, pattern, pattern);
        }
      }
    }

    query += ` ORDER BY e.employee_id ASC`;

    const { rows, durationMs } = await executeQuery<any[]>(
      query,
      params,
      userRole === 'Employee'
        ? 'Employee Scoped Query (Restricted Visibility)'
        : 'Multi-Table JOIN (employees + departments + job_roles + manager self-join)'
    );

    return NextResponse.json({ employees: rows, durationMs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching employees' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      hireDate,
      salary,
      departmentId,
      roleId,
      managerId,
      userRole,
    } = body;

    // RBAC: Admin and HR only
    if (userRole !== 'Admin' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Access denied. Admin or HR role required.' }, { status: 403 });
    }

    if (!firstName || !lastName || !email || salary === undefined) {
      return NextResponse.json({ error: 'First name, last name, email, and salary are required.' }, { status: 400 });
    }

    const emailClean = email.trim().toLowerCase();
    const numSalary = parseFloat(salary);

    if (isNaN(numSalary) || numSalary < 0) {
      return NextResponse.json({ error: 'Salary must be a non-negative number.' }, { status: 400 });
    }

    // Check duplicate email
    const { rows: existing } = await executeQuery<any[]>(
      `SELECT employee_id FROM employees WHERE email = ?`,
      [emailClean],
      'Unique Email Constraint Verification'
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: 'An employee with this email already exists.' }, { status: 409 });
    }

    const insertSql = `
      INSERT INTO employees (
        first_name, last_name, email, phone, hire_date,
        salary, department_id, role_id, manager_id, employment_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `;

    const { rows } = await executeQuery<any>(
      insertSql,
      [
        firstName.trim(),
        lastName.trim(),
        emailClean,
        phone?.trim() || null,
        hireDate || new Date().toISOString().substring(0, 10),
        numSalary,
        departmentId ? parseInt(departmentId, 10) : null,
        roleId ? parseInt(roleId, 10) : null,
        managerId ? parseInt(managerId, 10) : null,
      ],
      'Tuple Insertion with Foreign Key References'
    );

    return NextResponse.json({
      success: true,
      employeeId: rows.insertId,
      message: `Employee created with ID ${rows.insertId}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error adding employee' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      employeeId,
      email,
      phone,
      salary,
      departmentId,
      roleId,
      managerId,
      employmentStatus,
      userRole,
      userEmployeeId,
    } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required.' }, { status: 400 });
    }

    const empId = parseInt(employeeId, 10);

    // If Employee role: can only update their own contact information
    if (userRole === 'Employee') {
      if (parseInt(userEmployeeId, 10) !== empId) {
        return NextResponse.json({ error: 'Access denied. You can only update your own details.' }, { status: 403 });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (email !== undefined) {
        updates.push('email = ?');
        params.push(email.trim().toLowerCase());
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        params.push(phone.trim() || null);
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No contact changes provided.' }, { status: 400 });
      }

      params.push(empId);
      await executeQuery(
        `UPDATE employees SET ${updates.join(', ')} WHERE employee_id = ? AND employment_status = 'Active'`,
        params,
        'Self-Service Contact Information Update'
      );

      return NextResponse.json({ success: true, message: 'Contact details updated successfully.' });
    }

    // Admin / HR update
    if (userRole !== 'Admin' && userRole !== 'HR') {
      return NextResponse.json({ error: 'Access denied. Admin or HR role required.' }, { status: 403 });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (email !== undefined && email.trim()) {
      updates.push('email = ?');
      params.push(email.trim().toLowerCase());
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone.trim() || null);
    }
    if (salary !== undefined) {
      const s = parseFloat(salary);
      if (s >= 0) {
        updates.push('salary = ?');
        params.push(s);
      }
    }
    if (departmentId !== undefined) {
      updates.push('department_id = ?');
      params.push(departmentId ? parseInt(departmentId, 10) : null);
    }
    if (roleId !== undefined) {
      updates.push('role_id = ?');
      params.push(roleId ? parseInt(roleId, 10) : null);
    }
    if (managerId !== undefined) {
      updates.push('manager_id = ?');
      params.push(managerId ? parseInt(managerId, 10) : null);
    }
    if (employmentStatus !== undefined) {
      if (['Active', 'Inactive', 'On Leave'].includes(employmentStatus)) {
        updates.push('employment_status = ?');
        params.push(employmentStatus);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No update fields provided.' }, { status: 400 });
    }

    params.push(empId);
    await executeQuery(
      `UPDATE employees SET ${updates.join(', ')} WHERE employee_id = ?`,
      params,
      'Administrative Tuple Update with In-Place Column Modification'
    );

    return NextResponse.json({ success: true, message: 'Employee updated successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating employee' }, { status: 500 });
  }
}
