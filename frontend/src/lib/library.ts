/**
 * The Staffly query library: real statements issued by backend/employee_backend.py,
 * with `%s` placeholders shown as `?`, plus a hand-authored plan for each.
 *
 * The plans are illustrations, not captured EXPLAIN output. They are derived from
 * the indexes declared in database/schemas.sql (InnoDB, MySQL 8/9) and only claim
 * index usage that DDL supports. Row counts assume a small demo dataset
 * (about 120 employees, 40 accounts, 8 departments, 2,500 attendance rows,
 * 600 payroll rows).
 */
import type { AccessType, LibraryQuery, PlanNode } from "./types";

/** Strip common leading indentation so SQL in template literals reads cleanly. */
function sql(s: string): string {
  const lines = s.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => (l.match(/^ */) as RegExpMatchArray)[0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
}

function node(
  op: string,
  detail: string,
  rows: number,
  why: string,
  children: PlanNode[] = [],
  extra: { table?: string; access?: AccessType; key?: string } = {},
): PlanNode {
  return { op, detail, rows, why, children, ...extra };
}

/** PRIMARY KEY equality lookup on `table`. */
function pkLookup(table: string, alias: string, predicate: string, access: AccessType, why: string): PlanNode {
  return node("Single-row index lookup", `${table} ${alias} using PRIMARY (${predicate})`, 1, why, [], {
    table,
    access,
    key: "PRIMARY",
  });
}

const LEFT_JOIN_WHY =
  "A LEFT JOIN keeps every employee even without a match. Department, role and manager can be NULL, so those rows must stay.";

/**
 * The employees e LEFT JOIN departments d LEFT JOIN job_roles j LEFT JOIN employees m
 * chain shared by the directory and the three employee searches. `outer` is how
 * employees e itself is read; the three joined tables are PRIMARY key lookups.
 */
function directoryJoins(outer: PlanNode, rows: number): PlanNode {
  const d = pkLookup(
    "departments",
    "d",
    "department_id = e.department_id",
    "eq_ref",
    "department_id is the full PRIMARY KEY, so each employee matches at most one department (eq_ref). A NULL department_id gives a NULL row.",
  );
  const j = pkLookup(
    "job_roles",
    "j",
    "role_id = e.role_id",
    "eq_ref",
    "role_id is the PRIMARY KEY, so at most one row per employee. That is the eq_ref pattern.",
  );
  const m = pkLookup(
    "employees",
    "m",
    "employee_id = e.manager_id",
    "eq_ref",
    "A self join reads employees again under alias m. It is just another primary key lookup per employee.",
  );
  const l1 = node("Nested loop left join", "e LEFT JOIN departments d", rows, LEFT_JOIN_WHY, [outer, d]);
  const l2 = node(
    "Nested loop left join",
    "... LEFT JOIN job_roles j",
    rows,
    "Joins run as nested loops: for each row, probe the next table. Each extra join adds one cheap index probe.",
    [l1, j],
  );
  return node(
    "Nested loop left join",
    "... LEFT JOIN employees m (self join)",
    rows,
    "The last join in the chain. Row count stays the same because each match is unique.",
    [l2, m],
  );
}

export const LIBRARY: LibraryQuery[] = [
  /* ------------------------------------------------------------ Auth */
  {
    id: "login-lookup",
    title: "Log in: find the account by username",
    fn: "login_user",
    category: "Auth",
    sql: sql(`
      SELECT
          ua.account_id,
          ua.employee_id,
          ua.username,
          ua.password_hash,
          ua.access_role,
          ua.account_status,
          CONCAT(e.first_name, ' ', e.last_name) AS employee_name
      FROM user_accounts ua
      JOIN employees e
          ON ua.employee_id = e.employee_id
      WHERE ua.username = ?
    `),
    params: ["maria.hr"],
    tables: ["user_accounts", "employees"],
    concepts: ["Unique index", "Inner join"],
    summary:
      "Turns a typed username into one account row; the password hash is checked in Python, not SQL.",
    plan: node(
      "Nested loop inner join",
      "user_accounts ua, employees e",
      1,
      "WHERE pins ua to one row, so the statement costs two index probes.",
      [
        node(
          "Single-row index lookup",
          "user_accounts ua using uq_account_username (username = ?)",
          1,
          "username has a UNIQUE index, so at most one row matches and the optimizer treats it as const. The bare column makes it sargable.",
          [],
          { table: "user_accounts", access: "const", key: "uq_account_username" },
        ),
        node(
          "Single-row index lookup",
          "employees e using PRIMARY (employee_id = ua.employee_id)",
          1,
          "Once ua is read, ua.employee_id is a known constant. So this is a primary key lookup too.",
          [],
          { table: "employees", access: "const", key: "PRIMARY" },
        ),
      ],
    ),
  },
  {
    id: "login-touch",
    title: "Log in: record last_login",
    fn: "login_user",
    category: "Update",
    sql: sql(`
      UPDATE user_accounts
      SET last_login = CURRENT_TIMESTAMP
      WHERE account_id = ?
    `),
    params: [7],
    tables: ["user_accounts"],
    concepts: ["Clustered index", "Row lock"],
    summary:
      "Stamps the login time through the primary key; no index needs updating.",
    plan: node(
      "Update",
      "user_accounts SET last_login",
      1,
      "An UPDATE first locates the rows (a read), then changes them. Cost is mostly the locate step.",
      [
        pkLookup(
          "user_accounts",
          "",
          "account_id = ?",
          "const",
          "account_id is the PRIMARY KEY, and in InnoDB that is the table itself. Only that one record is locked and changed.",
        ),
      ],
    ),
  },
  /* ------------------------------------------------------- Aggregate */
  {
    id: "admin-count",
    title: "Count active Admin accounts",
    fn: "update_user_account_role",
    category: "Aggregate",
    sql: sql(`
      SELECT COUNT(*) AS admin_count
      FROM user_accounts
      WHERE access_role = 'Admin'
        AND account_status = 'Active'
    `),
    params: [],
    tables: ["user_accounts"],
    concepts: ["Aggregation", "Full table scan"],
    summary:
      "Checks that at least one active Admin would remain; the table is small enough to scan.",
    plan: node(
      "Aggregate",
      "COUNT(*) over matching rows",
      1,
      "Without GROUP BY, all rows collapse into one output row. Only a running counter is kept.",
      [
        node(
          "Filter",
          "access_role = 'Admin' AND account_status = 'Active'",
          3,
          "Both conditions are tested on each scanned row. CHECK constraints do not create indexes.",
          [
            node(
              "Table scan",
              "user_accounts (full scan of the clustered index)",
              40,
              "Neither column is indexed, so every row is read. With about 40 rows, that is cheaper than an index.",
              [],
              { table: "user_accounts", access: "ALL" },
            ),
          ],
        ),
      ],
    ),
  },
  /* ------------------------------------------------------------ Join */
  {
    id: "directory-all",
    title: "Employee directory (admin and HR view)",
    fn: "view_employees",
    category: "Join",
    sql: sql(`
      SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          e.email,
          e.phone,
          e.hire_date,
          e.salary,
          d.department_name,
          j.role_title,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
          e.employment_status
      FROM employees e
      LEFT JOIN departments d
          ON e.department_id = d.department_id
      LEFT JOIN job_roles j
          ON e.role_id = j.role_id
      LEFT JOIN employees m
          ON e.manager_id = m.employee_id
      ORDER BY e.employee_id
    `),
    params: [],
    tables: ["employees", "departments", "job_roles"],
    concepts: ["Left outer join", "Self join"],
    summary:
      "One row per employee with department, job title and manager; LEFT JOINs keep rows with missing values.",
    plan: directoryJoins(
      node(
        "Table scan",
        "employees e (clustered index order)",
        120,
        "No WHERE, so a full scan is cheapest. The primary key already gives employee_id order, so no sort is needed.",
        [],
        { table: "employees", access: "ALL", key: "PRIMARY" },
      ),
      120,
    ),
  },
  {
    id: "payroll-by-month",
    title: "Payroll for one month (all employees)",
    fn: "view_payroll",
    category: "Join",
    sql: sql(`
      SELECT
          p.payroll_id,
          p.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
          p.pay_month,
          p.basic_salary,
          p.allowances,
          p.deductions,
          p.net_salary,
          p.payment_status,
          p.payment_date
      FROM payroll p
      JOIN employees e
          ON p.employee_id = e.employee_id
      WHERE 1 = 1
        AND p.pay_month = ?
      ORDER BY p.pay_month DESC, p.employee_id
    `),
    params: ["2026-10-01"],
    tables: ["payroll", "employees"],
    concepts: ["Leftmost prefix", "Filesort"],
    summary:
      "A month-only filter cannot use the (employee_id, pay_month) index, so payroll is scanned in full.",
    plan: node(
      "Sort",
      "filesort by pay_month DESC, employee_id",
      40,
      "Scan order differs from ORDER BY, so MySQL sorts the matching rows. The sort is small.",
      [
        node(
          "Nested loop inner join",
          "payroll p, employees e",
          40,
          "payroll is the driving table because its filter leaves far fewer rows than scanning employees would.",
          [
            node(
              "Filter",
              "p.pay_month = ?",
              40,
              "Applied to every scanned row. '1 = 1' is folded away; it only lets Python append AND conditions.",
              [
                node(
                  "Table scan",
                  "payroll p (full scan of the clustered index)",
                  600,
                  "A B-tree can only be searched from its leftmost column, and pay_month is the second. So this filter cannot use the index and the table is scanned.",
                  [],
                  { table: "payroll", access: "ALL" },
                ),
              ],
            ),
            pkLookup(
              "employees",
              "e",
              "employee_id = p.employee_id",
              "eq_ref",
              "One primary key probe per payroll row fetches the employee name (eq_ref).",
            ),
          ],
        ),
      ],
    ),
  },
  {
    id: "attendance-by-employee",
    title: "One employee's attendance history",
    fn: "view_attendance",
    category: "Join",
    sql: sql(`
      SELECT
          a.attendance_id,
          a.employee_id,
          CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
          a.attendance_date,
          a.check_in,
          a.check_out,
          a.attendance_status
      FROM attendance a
      JOIN employees e
          ON a.employee_id = e.employee_id
      WHERE 1 = 1
        AND a.employee_id = ?
      ORDER BY a.attendance_date DESC, a.employee_id
    `),
    params: [12],
    tables: ["attendance", "employees"],
    concepts: ["Composite index", "Index-ordered output"],
    summary:
      "Newest first for one employee; the index is already date-sorted, so no sort is needed.",
    plan: node(
      "Nested loop inner join",
      "employees e, attendance a",
      180,
      "One employee row joined to all of their attendance rows.",
      [
        pkLookup(
          "employees",
          "e",
          "employee_id = ?",
          "const",
          "Equality propagation makes e.employee_id a constant. So employees is read once as a const table.",
        ),
        node(
          "Index lookup (backward)",
          "attendance a using uq_employee_attendance (employee_id = ?)",
          180,
          "employee_id is the leftmost index column, so the engine seeks to that employee's block (ref). The block is ordered by date, so reading it backwards needs no sort.",
          [],
          { table: "attendance", access: "ref", key: "uq_employee_attendance" },
        ),
      ],
    ),
  },
  /* ---------------------------------------------------------- Search */
  {
    id: "search-by-id",
    title: "Search employee by numeric id",
    fn: "search_employee",
    category: "Search",
    sql: sql(`
      SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          e.email,
          e.phone,
          e.hire_date,
          e.salary,
          d.department_name,
          j.role_title,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
          e.employment_status
      FROM employees e
      LEFT JOIN departments d
          ON e.department_id = d.department_id
      LEFT JOIN job_roles j
          ON e.role_id = j.role_id
      LEFT JOIN employees m
          ON e.manager_id = m.employee_id
      WHERE e.employee_id = ?
    `),
    params: [12],
    tables: ["employees", "departments", "job_roles"],
    concepts: ["Primary key point lookup", "Sargable predicate"],
    summary:
      "All-digit search text is treated as an id: one primary key lookup, plus joins for the names.",
    plan: directoryJoins(
      pkLookup(
        "employees",
        "e",
        "employee_id = ?",
        "const",
        "The bare primary key column is compared to a parameter (sargable). One tree descent reads exactly one row.",
      ),
      1,
    ),
  },
  {
    id: "search-by-email",
    title: "Search employee by email (LOWER)",
    fn: "search_employee",
    category: "Search",
    sql: sql(`
      SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          e.email,
          e.phone,
          e.hire_date,
          e.salary,
          d.department_name,
          j.role_title,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
          e.employment_status
      FROM employees e
      LEFT JOIN departments d
          ON e.department_id = d.department_id
      LEFT JOIN job_roles j
          ON e.role_id = j.role_id
      LEFT JOIN employees m
          ON e.manager_id = m.employee_id
      WHERE LOWER(e.email) = LOWER(?)
    `),
    params: ["Maria.Lopez@staffly.com"],
    tables: ["employees", "departments", "job_roles"],
    concepts: ["Non-sargable predicate", "Case-insensitive collation"],
    summary:
      "LOWER(email) hides the column from the unique index, so every row is checked; plain email = ? works.",
    plan: directoryJoins(
      node(
        "Filter",
        "LOWER(e.email) = LOWER(?)",
        1,
        "Evaluated row by row. MySQL cannot know LOWER(email) is unique, since uniqueness is declared on email itself.",
        [
          node(
            "Table scan",
            "employees e (full scan; uq_employee_email unusable)",
            120,
            "A function on the column makes the predicate non-sargable, so the index is ignored. Use email = ? instead.",
            [],
            { table: "employees", access: "ALL" },
          ),
        ],
      ),
      1,
    ),
  },
  {
    id: "search-by-name",
    title: "Search employee by name fragment (LIKE '%x%')",
    fn: "search_employee",
    category: "Search",
    sql: sql(`
      SELECT
          e.employee_id,
          e.first_name,
          e.last_name,
          e.email,
          e.phone,
          e.hire_date,
          e.salary,
          d.department_name,
          j.role_title,
          CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
          e.employment_status
      FROM employees e
      LEFT JOIN departments d
          ON e.department_id = d.department_id
      LEFT JOIN job_roles j
          ON e.role_id = j.role_id
      LEFT JOIN employees m
          ON e.manager_id = m.employee_id
      WHERE CONCAT(e.first_name, ' ', e.last_name) LIKE ?
         OR e.first_name LIKE ?
         OR e.last_name LIKE ?
      ORDER BY e.employee_id
    `),
    params: ["%mar%", "%mar%", "%mar%"],
    tables: ["employees", "departments", "job_roles"],
    concepts: ["Leading wildcard", "Full table scan"],
    summary:
      "A leading % wildcard and OR-ed predicates rule out indexes, so the whole table is scanned.",
    plan: directoryJoins(
      node(
        "Filter",
        "CONCAT(first_name, ' ', last_name) LIKE ? OR first_name LIKE ? OR last_name LIKE ?",
        6,
        "All three OR-ed conditions are tested on each row. No index exists for any branch, so there is no index merge.",
        [
          node(
            "Table scan",
            "employees e (full scan in PRIMARY order)",
            120,
            "A B-tree helps LIKE only with a fixed prefix ('mar%'), not a leading wildcard. So every row is read, already in ORDER BY order.",
            [],
            { table: "employees", access: "ALL", key: "PRIMARY" },
          ),
        ],
      ),
      6,
    ),
  },
  /* ---------------------------------------------------------- Lookup */
  {
    id: "email-exists",
    title: "Does this email already exist?",
    fn: "add_employee",
    category: "Lookup",
    sql: sql(`
      SELECT employee_id FROM employees WHERE email = ?
    `),
    params: ["new.hire@staffly.com"],
    tables: ["employees"],
    concepts: ["Covering index", "Check-then-act race"],
    summary:
      "A pre-check before inserting; the unique email index answers it without reading the table.",
    plan: node(
      "Covering index lookup",
      "employees using uq_employee_email (email = ?)",
      1,
      "Reading only index entries is cheaper than reading rows, and nothing else is needed.",
      [
        node(
          "Single-row index lookup",
          "employees using uq_employee_email (email = ?)",
          1,
          "email is UNIQUE, so at most one entry matches (const). The index also carries employee_id, so the table is never read.",
          [],
          { table: "employees", access: "const", key: "uq_employee_email" },
        ),
      ],
    ),
  },
  {
    id: "department-list",
    title: "Department dropdown",
    fn: "get_departments",
    category: "Lookup",
    sql: sql(`
      SELECT department_id, department_name
      FROM departments
      ORDER BY department_name
    `),
    params: [],
    tables: ["departments"],
    concepts: ["Covering index", "Index-ordered output"],
    summary:
      "Department names come straight from the sorted unique index, with no extra sort.",
    plan: node(
      "Covering index scan",
      "departments using uq_department_name",
      8,
      "Walks the whole index without any table lookups.",
      [
        node(
          "Index scan",
          "departments using uq_department_name (ordered by department_name)",
          8,
          "Every index entry is read in order, which already matches ORDER BY, so no sort. It is covering: the name and primary key are enough.",
          [],
          { table: "departments", access: "index", key: "uq_department_name" },
        ),
      ],
    ),
  },
  {
    id: "attendance-duplicate-check",
    title: "Attendance already recorded for this day?",
    fn: "mark_attendance",
    category: "Lookup",
    sql: sql(`
      SELECT attendance_id
      FROM attendance
      WHERE employee_id = ? AND attendance_date = ?
    `),
    params: [12, "2026-10-30"],
    tables: ["attendance"],
    concepts: ["Covering index", "Check-then-act race"],
    summary:
      "Checks whether today's row exists; one covering index entry answers it without touching the table.",
    plan: node(
      "Covering index lookup",
      "attendance using uq_employee_attendance",
      1,
      "One probe answers the question.",
      [
        node(
          "Single-row index lookup",
          "attendance using uq_employee_attendance (employee_id = ?, attendance_date = ?)",
          1,
          "Equality on every UNIQUE column gives at most one row (const). The primary key is in the index, so the table is not read.",
          [],
          { table: "attendance", access: "const", key: "uq_employee_attendance" },
        ),
      ],
    ),
  },
  {
    id: "payroll-duplicate-check",
    title: "Payroll already generated for this month?",
    fn: "generate_payroll",
    category: "Lookup",
    sql: sql(`
      SELECT payroll_id
      FROM payroll
      WHERE employee_id = ? AND pay_month = ?
    `),
    params: [12, "2026-10-01"],
    tables: ["payroll"],
    concepts: ["Covering index", "Check-then-act race"],
    summary:
      "Same pattern as the attendance check, using uq_employee_pay_month, and stops before a duplicate insert.",
    plan: node(
      "Covering index lookup",
      "payroll using uq_employee_pay_month",
      1,
      "One probe, no table access.",
      [
        node(
          "Single-row index lookup",
          "payroll using uq_employee_pay_month (employee_id = ?, pay_month = ?)",
          1,
          "Both UNIQUE columns are compared by equality, so at most one row (const). payroll_id comes from the index.",
          [],
          { table: "payroll", access: "const", key: "uq_employee_pay_month" },
        ),
      ],
    ),
  },
  /* ------------------------------------------------------- Aggregate */
  {
    id: "attendance-monthly",
    title: "Monthly attendance summary",
    fn: "monthly_attendance_summary",
    category: "Aggregate",
    sql: sql(`
      SELECT
          COUNT(*) AS total_days_recorded,
          COALESCE(SUM(attendance_status = 'Present'), 0) AS present_days,
          COALESCE(SUM(attendance_status = 'Absent'), 0) AS absent_days,
          COALESCE(SUM(attendance_status = 'Half Day'), 0) AS half_days,
          COALESCE(SUM(attendance_status = 'Holiday'), 0) AS holidays
      FROM attendance
      WHERE employee_id = ?
        AND attendance_date >= ?
        AND attendance_date < ?
    `),
    params: [12, "2026-10-01", "2026-11-01"],
    tables: ["attendance"],
    concepts: ["Range scan", "Half-open interval"],
    summary:
      "One employee, one month, five counts; the date range lets the index visit only that month.",
    plan: node(
      "Aggregate",
      "COUNT(*), SUM(attendance_status = ...) x4 (no GROUP BY)",
      1,
      "All five aggregates are computed in one pass into a single row. COALESCE turns NULL sums into 0.",
      [
        node(
          "Index range scan",
          "attendance using uq_employee_attendance (employee_id = ? AND attendance_date >= ? AND attendance_date < ?)",
          22,
          "Equality on employee_id plus a date range reads just that month (range). Wrapping the date in MONTH() would break this.",
          [],
          { table: "attendance", access: "range", key: "uq_employee_attendance" },
        ),
      ],
    ),
  },
  /* ---------------------------------------------------------- Insert */
  {
    id: "employee-insert",
    title: "Hire an employee",
    fn: "add_employee",
    category: "Insert",
    sql: sql(`
      INSERT INTO employees
      (first_name, last_name, email, phone, hire_date,
       salary, department_id, role_id, manager_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    params: ["Asha", "Rao", "asha.rao@staffly.com", "555-0142", "2026-10-30", 62000, 3, 5, 12],
    tables: ["employees", "departments", "job_roles"],
    concepts: ["Clustered index", "Foreign key check"],
    summary:
      "An INSERT mostly enforces rules: indexes, unique email, foreign keys and checks, all or nothing.",
    plan: node(
      "Insert",
      "employees (1 row)",
      1,
      "A write path, so no access type applies. Cost is the number of structures updated.",
      [
        node(
          "Write clustered record",
          "employees PRIMARY (employee_id = next AUTO_INCREMENT value)",
          1,
          "employee_id is omitted, so the auto-increment counter supplies it. New rows go to the end of the clustered index, which keeps inserts cheap.",
        ),
        node(
          "Write secondary entries",
          "uq_employee_email, fk_employee_department, fk_employee_role, fk_employee_manager",
          1,
          "Each secondary index gets an entry, and the UNIQUE email is checked. More indexes mean slower writes.",
        ),
        node(
          "Foreign key checks",
          "departments (department_id), job_roles (role_id), employees (employee_id as manager)",
          3,
          "Each non-NULL foreign key is checked by probing the parent table's primary key. NULL skips the check.",
        ),
        node(
          "Evaluate CHECK constraints",
          "chk_employee_salary (salary >= 0), chk_employment_status (employment_status IN ...)",
          1,
          "CHECK constraints run on the new row, and employment_status uses its DEFAULT. A violation rejects the statement.",
        ),
      ],
    ),
  },
  {
    id: "leave-apply",
    title: "Apply for leave",
    fn: "apply_for_leave",
    category: "Insert",
    sql: sql(`
      INSERT INTO leave_requests
          (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, ?, ?, ?, ?)
    `),
    params: [12, "Annual", "2026-12-22", "2026-12-26", "Family trip"],
    tables: ["leave_requests", "employees"],
    concepts: ["Foreign key check", "CHECK constraint"],
    summary:
      "New requests default to Pending; the database rejects bad dates and unknown employees.",
    plan: node(
      "Insert",
      "leave_requests (1 row)",
      1,
      "A write path: no read access type applies.",
      [
        node(
          "Write clustered record",
          "leave_requests PRIMARY (leave_id = next AUTO_INCREMENT value)",
          1,
          "Appended to the clustered index with a generated leave_id. Defaults fill leave_status and applied_at.",
        ),
        node(
          "Write secondary entries",
          "fk_leave_employee, fk_leave_reviewer",
          1,
          "Both foreign key columns are indexed, so each gets an entry. A NULL reviewed_by is stored fine.",
        ),
        node(
          "Foreign key check",
          "employees PRIMARY (employee_id = ?)",
          1,
          "The employee must exist: one primary key probe on employees. The NULL reviewer key is not checked.",
        ),
        node(
          "Evaluate CHECK constraints",
          "chk_leave_dates (end_date >= start_date), chk_leave_status",
          1,
          "Validated before the row is saved, even if a client skips the app's own checks.",
        ),
      ],
    ),
  },
  {
    id: "payroll-insert",
    title: "Generate a payroll record",
    fn: "generate_payroll",
    category: "Insert",
    sql: sql(`
      INSERT INTO payroll (
          employee_id,
          pay_month,
          basic_salary,
          allowances,
          deductions
      )
      VALUES (?, ?, ?, ?, ?)
    `),
    params: [12, "2026-10-01", 5000, 400, 150],
    tables: ["payroll", "employees"],
    concepts: ["Generated column", "Unique index"],
    summary:
      "net_salary is a STORED generated column, so MySQL computes it on insert and it cannot be inconsistent.",
    plan: node(
      "Insert",
      "payroll (1 row)",
      1,
      "A write path: no read access type applies.",
      [
        node(
          "Compute generated column",
          "net_salary = (basic_salary + allowances) - deductions  [STORED]",
          1,
          "net_salary is computed on write and stored, so reads cost nothing. It cannot be set manually.",
        ),
        node(
          "Write clustered record",
          "payroll PRIMARY (payroll_id = next AUTO_INCREMENT value)",
          1,
          "payment_status takes DEFAULT 'Pending' and created_at DEFAULT CURRENT_TIMESTAMP.",
        ),
        node(
          "Write secondary entry (unique)",
          "uq_employee_pay_month (employee_id, pay_month)",
          1,
          "A second payroll for the same employee and month fails here with a duplicate-key error. The constraint is the final authority.",
        ),
        node(
          "Foreign key check",
          "employees PRIMARY (employee_id = ?)",
          1,
          "The employee must exist: one primary key probe on employees. uq_employee_pay_month already serves this foreign key.",
        ),
        node(
          "Evaluate CHECK constraints",
          "chk_payment_status, chk_payroll_amounts (amounts >= 0 and basic + allowances >= deductions)",
          1,
          "The database rejects negative amounts and deductions larger than pay.",
        ),
      ],
    ),
  },
  /* ---------------------------------------------------------- Update */
  {
    id: "leave-review",
    title: "Approve or reject a leave request",
    fn: "review_leave_request",
    category: "Update",
    sql: sql(`
      UPDATE leave_requests
      SET leave_status = ?,
          reviewed_by = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE leave_id = ?
        AND leave_status = 'Pending'
    `),
    params: ["Approved", 3, 41],
    tables: ["leave_requests", "employees"],
    concepts: ["Compare-and-set update", "Row lock"],
    summary:
      "WHERE leave_status = 'Pending' makes this compare-and-set: only the first reviewer changes the row.",
    plan: node(
      "Update",
      "leave_requests SET leave_status, reviewed_by, reviewed_at",
      1,
      "Zero or one row changes; the affected-row count tells the app who won.",
      [
        node(
          "Filter",
          "leave_status = 'Pending'",
          1,
          "Tested on the row the primary key lookup locked. If someone already decided, nothing changes.",
          [
            pkLookup(
              "leave_requests",
              "",
              "leave_id = ?",
              "const",
              "leave_id is the PRIMARY KEY, so one row is found and locked. A second reviewer waits, then matches nothing.",
            ),
          ],
        ),
      ],
    ),
  },
];

/** Look up a query by id (undefined when unknown). */
export function getQuery(id: string): LibraryQuery | undefined {
  return LIBRARY.find((q) => q.id === id);
}

/** Source file the Python functions live in. */
export const BACKEND_FILE = "backend/employee_backend.py";

const ACCESS_RANK: Record<AccessType, number> = {
  const: 0,
  eq_ref: 1,
  ref: 2,
  range: 3,
  index: 4,
  ALL: 5,
};

/**
 * The dominant (least selective) access type anywhere in a plan, or null for pure
 * write paths. A join is only as good as its worst scan, so this is what to compare.
 */
export function dominantAccess(plan: PlanNode): AccessType | null {
  let worst: AccessType | null = null;
  const walk = (n: PlanNode) => {
    if (n.access && (worst === null || ACCESS_RANK[n.access] > ACCESS_RANK[worst])) worst = n.access;
    n.children.forEach(walk);
  };
  walk(plan);
  return worst;
}
