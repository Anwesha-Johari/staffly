import re
from decimal import Decimal, InvalidOperation
import getpass
import mysql.connector
from mysql.connector import Error
from datetime import date, time, datetime
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

def require_role(current_role, allowed_roles):
    """Allow an operation only for an authorized role."""

    if current_role not in allowed_roles:
        raise PermissionError(
            "Access denied. You do not have permission "
            "to perform this operation."
        )

def get_connection():
    """Connect to the Employee Management System database."""

    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME", "employee_management")
    )


def validate_employee(first_name, last_name, email, salary):
    """Check basic employee details before inserting."""

    if not first_name.strip() or not last_name.strip():
        raise ValueError("First name and last name are required.")

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email.strip()):
        raise ValueError("Please enter a valid email address.")

    try:
        salary = Decimal(str(salary))
    except (InvalidOperation, ValueError):
        raise ValueError("Salary must be a valid number.")

    if not salary.is_finite() or salary < 0:
        raise ValueError("Salary must be a non-negative number.")

    return salary


def add_employee(session, first_name, last_name, email, phone,
                 hire_date, salary, department_id,
                 role_id, manager_id=None):
    """Validate and add an employee with role-based authorization."""

    connection = None
    cursor = None

    try:
        require_session_role(session, ["Admin", "HR"])

        first_name = first_name.strip()
        last_name = last_name.strip()
        email = email.strip().lower()

        salary = validate_employee(
            first_name, last_name, email, salary
        )

        connection = get_connection()
        cursor = connection.cursor()

        # Check whether the email is already registered.
        cursor.execute(
            "SELECT employee_id FROM employees WHERE email = %s",
            (email,)
        )

        if cursor.fetchone():
            print("An employee with this email already exists.")
            return None

        query = """
            INSERT INTO employees
            (first_name, last_name, email, phone, hire_date,
             salary, department_id, role_id, manager_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            first_name, last_name, email, phone,
            hire_date, salary, department_id,
            role_id, manager_id
        )

        cursor.execute(query, values)
        connection.commit()

        new_id = cursor.lastrowid
        print("Employee added successfully!")
        print("New employee ID:", new_id)
        return new_id

    except PermissionError as error:
        print("Access denied:", error)
        return None

    except ValueError as error:
        print("Invalid employee details:", error)
        return None

    except Error as error:
        if connection is not None and connection.is_connected():
            connection.rollback()

        if error.errno == 1062:
            print(
                "A duplicate value was detected. "
                "Check the employee email."
            )
        else:
            print("Could not add employee:", error)

        return None

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def view_employees(session):
    """Return employee records according to the user's role."""

    connection = None
    cursor = None

    try:
        # Check user permissions
        require_session_role(session, ["Admin", "HR", "Employee"])

        connection = get_connection()
        cursor = connection.cursor()

        query = """
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
                CONCAT(m.first_name, ' ', m.last_name)
                    AS manager_name,
                e.employment_status
            FROM employees e
            LEFT JOIN departments d
                ON e.department_id = d.department_id
            LEFT JOIN job_roles j
                ON e.role_id = j.role_id
            LEFT JOIN employees m
                ON e.manager_id = m.employee_id
        """

        # Employees can only view their own records
        if session.access_role == "Employee":
            query += " WHERE e.employee_id = %s"
            query += " ORDER BY e.employee_id"

            cursor.execute(
                query,
                (session.employee_id,)
            )

        else:
            query += " ORDER BY e.employee_id"
            cursor.execute(query)

        # Retrieve employee records
        employees = cursor.fetchall()
        print("DEBUG - Retrieved employee records:", employees)

        # Return records to the frontend
        return employees

    except PermissionError as error:
        print("Access denied:", error)
        return []

    except Error as error:
        print("Could not retrieve employees:", error)
        return []

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def search_employee(session, search_value):
    """Search employee records according to the user's role."""

    connection = None
    cursor = None

    try:
        require_session_role(session, ["Admin", "HR", "Employee"])

        search_value = str(search_value).strip()

        if not search_value:
            print("Please enter an employee ID, name, or email.")
            return None

        # Employees may search only for their own employee ID.
        if session.access_role == "Employee":
            if (
                not search_value.isdigit()
                or int(search_value) != session.employee_id
            ):
                print("Access denied: You can search only your own record.")
                return None

        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        base_query = """
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
                CONCAT(m.first_name, ' ', m.last_name)
                    AS manager_name,
                e.employment_status
            FROM employees e
            LEFT JOIN departments d
                ON e.department_id = d.department_id
            LEFT JOIN job_roles j
                ON e.role_id = j.role_id
            LEFT JOIN employees m
                ON e.manager_id = m.employee_id
        """

        if search_value.isdigit():
            query = base_query + """
                WHERE e.employee_id = %s
            """
            cursor.execute(query, (int(search_value),))

        elif "@" in search_value:
            query = base_query + """
                WHERE LOWER(e.email) = LOWER(%s)
            """
            cursor.execute(query, (search_value,))

        else:
            name_pattern = f"%{search_value}%"

            query = base_query + """
                WHERE CONCAT(e.first_name, ' ', e.last_name)
                          LIKE %s
                   OR e.first_name LIKE %s
                   OR e.last_name LIKE %s
                ORDER BY e.employee_id
            """

            cursor.execute(
                query,
                (name_pattern, name_pattern, name_pattern)
            )

        employees = cursor.fetchall()

        if not employees:
            print("No matching employee found.")
            return None

        for employee in employees:
            print("-" * 40)
            print("Employee ID:", employee["employee_id"])
            print(
                "Name:",
                employee["first_name"],
                employee["last_name"]
            )
            print("Email:", employee["email"])
            print("Phone:", employee["phone"])
            print("Hire Date:", employee["hire_date"])
            print("Salary:", employee["salary"])
            print("Department:", employee["department_name"])
            print("Job Role:", employee["role_title"])
            print("Manager:", employee["manager_name"])
            print("Status:", employee["employment_status"])

        print("-" * 40)
        print("Matching employees:", len(employees))

        return employees[0] if len(employees) == 1 else employees

    except PermissionError as error:
        print("Access denied:", error)
        return None

    except Error as error:
        print("Database error:", error)
        return None

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def update_employee(
    session,
    employee_id,
    first_name=None,
    last_name=None,
    email=None,
    phone=None,
    hire_date=None,
    salary=None,
    department_id=None,
    role_id=None,
    manager_id=None,
    employment_status=None
):
    """Update an employee record. Admin and HR only."""

    try:
        require_session_role(session, ["Admin", "HR"])
    except PermissionError as error:
        print(error)
        return False

    updates = {}

    if first_name is not None:
        if not first_name.strip():
            print("First name cannot be empty.")
            return False
        updates["first_name"] = first_name.strip()

    if last_name is not None:
        if not last_name.strip():
            print("Last name cannot be empty.")
            return False
        updates["last_name"] = last_name.strip()

    if email is not None:
        email = email.strip().lower()

        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            print("Please enter a valid email address.")
            return False

        updates["email"] = email

    if phone is not None:
        updates["phone"] = phone.strip() if phone.strip() else None

    if hire_date is not None:
        updates["hire_date"] = hire_date

    if salary is not None:
        try:
            salary = Decimal(str(salary))
        except (InvalidOperation, ValueError):
            print("Salary must be a valid number.")
            return False

        if not salary.is_finite() or salary < 0:
            print("Salary cannot be negative or invalid.")
            return False

        updates["salary"] = salary

    if department_id is not None:
        updates["department_id"] = department_id

    if role_id is not None:
        updates["role_id"] = role_id

    if manager_id is not None:
        updates["manager_id"] = manager_id

    if employment_status is not None:
        allowed_statuses = ("Active", "Inactive", "On Leave")

        if employment_status not in allowed_statuses:
            print("Invalid employment status.")
            return False

        updates["employment_status"] = employment_status

    if not updates:
        print("No changes were provided.")
        return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT employee_id FROM employees WHERE employee_id = %s",
            (employee_id,)
        )

        if cursor.fetchone() is None:
            print("Employee not found.")
            return False

        set_clause = ", ".join(
            f"{column} = %s" for column in updates
        )

        values = list(updates.values())
        values.append(employee_id)

        query = (
            f"UPDATE employees SET {set_clause} "
            "WHERE employee_id = %s"
        )

        cursor.execute(query, tuple(values))
        connection.commit()

        print("Employee updated successfully.")
        return True

    except Error as error:
        if connection is not None and connection.is_connected():
            connection.rollback()

        if error.errno == 1062:
            print("That email address is already in use.")
        elif error.errno == 1452:
            print("Invalid department, job role, or manager ID.")
        else:
            print("Database error:", error)

        return False

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def update_own_contact(session, email=None, phone=None):
    """Allow an authenticated employee to update their own email and phone."""

    # Validate the session and role
    try:
        require_session_role(session, ["Admin", "HR", "Employee"])
    except PermissionError as error:
        print(error)
        return False

    # Only an employee's own session may use this function.
    # HR/Admin should use the authorized employee-update function
    # when changing another employee's details.
    employee_id = session.employee_id

    connection = None
    cursor = None

    try:
        updates = {}

        if email is not None:
            if not isinstance(email, str):
                print("Please enter a valid email address.")
                return False

            email = email.strip().lower()

            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                print("Please enter a valid email address.")
                return False

            updates["email"] = email

        if phone is not None:
            if not isinstance(phone, str):
                print("Please enter a valid phone number.")
                return False

            phone = phone.strip()
            updates["phone"] = phone if phone else None

        if not updates:
            print("No contact changes were provided.")
            return False

        connection = get_connection()
        cursor = connection.cursor()

        # Confirm that the employee exists and is active
        cursor.execute(
            """
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
              AND employment_status = 'Active'
            """,
            (employee_id,)
        )

        if cursor.fetchone() is None:
            print("Active employee record not found.")
            return False

        # Only email and phone can be changed by this function.
        set_clause = ", ".join(
            f"{column} = %s" for column in updates
        )

        values = list(updates.values())
        values.append(employee_id)

        query = (
            f"UPDATE employees SET {set_clause} "
            "WHERE employee_id = %s"
        )

        cursor.execute(query, tuple(values))
        connection.commit()

        if cursor.rowcount == 0:
            print("No contact details were changed.")
            return True

        print("Your contact details were updated successfully.")
        return True

    except Error as error:
        if connection is not None and connection.is_connected():
            connection.rollback()

        if error.errno == 1062:
            print("That email address is already in use.")
        else:
            print("Database error:", error)

        return False

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def deactivate_employee(session, employee_id):
    """Mark an employee as Inactive. Admin and HR only."""

    try:
        require_session_role(session, ["Admin", "HR"])
    except PermissionError as error:
        print(error)
        return False

    connection = None
    cursor = None

    try:
        if not isinstance(employee_id, int) or employee_id <= 0:
            print("Invalid employee ID.")
            return False

        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT employment_status
            FROM employees
            WHERE employee_id = %s
            """,
            (employee_id,)
        )

        result = cursor.fetchone()

        if result is None:
            print("Employee not found.")
            return False

        if result[0] == "Inactive":
            print("This employee is already inactive.")
            return False

        cursor.execute(
            """
            UPDATE employees
            SET employment_status = 'Inactive'
            WHERE employee_id = %s
            """,
            (employee_id,)
        )

        connection.commit()

        print("Employee deactivated successfully.")
        print("The employee's historical records have been preserved.")
        return True

    except Error as error:
        if connection is not None and connection.is_connected():
            connection.rollback()

        print("Database error:", error)
        return False

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()



def view_employees_by_status(session, status):
    """Display employees filtered by employment status."""

    connection = None
    cursor = None

    try:
        require_session_role(session, ("Admin", "HR"))

        allowed_statuses = ("Active", "Inactive", "On Leave")

        if status not in allowed_statuses:
            print("Invalid employment status.")
            return

        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
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
                CONCAT(m.first_name, ' ', m.last_name)
                    AS manager_name,
                e.employment_status
            FROM employees e
            LEFT JOIN departments d
                ON e.department_id = d.department_id
            LEFT JOIN job_roles j
                ON e.role_id = j.role_id
            LEFT JOIN employees m
                ON e.manager_id = m.employee_id
            WHERE e.employment_status = %s
            ORDER BY e.employee_id
        """

        cursor.execute(query, (status,))
        employees = cursor.fetchall()

        print(f"\n--- {status} Employees ---")

        if not employees:
            print("No employees found with this status.")
            return

        for employee in employees:
            print("-" * 40)
            print("Employee ID:", employee["employee_id"])
            print(
                "Name:",
                employee["first_name"],
                employee["last_name"]
            )
            print("Email:", employee["email"])
            print("Phone:", employee["phone"])
            print("Hire Date:", employee["hire_date"])
            print("Salary:", employee["salary"])
            print("Department:", employee["department_name"])
            print("Job Role:", employee["role_title"])
            print("Manager:", employee["manager_name"])
            print("Status:", employee["employment_status"])

        print("-" * 40)
        print("Total employees:", len(employees))

    except PermissionError as error:
        print("Access denied:", error)

    except Error as error:
        print("Database error:", error)

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def view_active_employees(session):
    """Display only active employees."""
    view_employees_by_status(session, "Active")


def view_inactive_employees(session):
    """Display only inactive employees."""
    view_employees_by_status(session, "Inactive")



def reactivate_employee(session, employee_id):
    """Reactivate an inactive employee. Admin and HR only."""

    # Step 1: Check authorization
    try:
        require_session_role(session, ["Admin", "HR"])
    except PermissionError as error:
        print(error)
        return False

    connection = None
    cursor = None

    try:
        # Step 2: Validate employee ID
        if not isinstance(employee_id, int) or employee_id <= 0:
            print("Invalid employee ID.")
            return False

        # Step 3: Connect to the database
        connection = get_connection()
        cursor = connection.cursor()

        # Step 4: Check whether the employee exists
        cursor.execute(
            """
            SELECT employment_status
            FROM employees
            WHERE employee_id = %s
            """,
            (employee_id,)
        )

        result = cursor.fetchone()

        if result is None:
            print("Employee not found.")
            return False

        # Step 5: Check whether reactivation is necessary
        if result[0] != "Inactive":
            print("This employee is not inactive.")
            return False

        # Step 6: Reactivate the employee
        cursor.execute(
            """
            UPDATE employees
            SET employment_status = 'Active'
            WHERE employee_id = %s
            """,
            (employee_id,)
        )

        connection.commit()

        print("Employee reactivated successfully.")
        return True

    except Error as error:
        if connection is not None and connection.is_connected():
            connection.rollback()

        print("Database error:", error)
        return False

    finally:
        # Step 7: Close database resources
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


def mark_attendance(
    session,
    employee_id,
    attendance_date,
    attendance_status,
    check_in=None,
    check_out=None
):
    """Record attendance with session-based authorization."""

    # Only authenticated sessions with these roles are allowed.
    if not require_session_role(session, ["Admin", "HR", "Employee"]):
        print("Unauthorized. Please log in with a valid account.")
        return False

    # Employees can record attendance only for themselves.
    if (
        session.access_role == "Employee"
        and employee_id != session.employee_id
    ):
        print("Employees can record attendance only for themselves.")
        return False

    valid_statuses = {"Present", "Absent", "Half Day", "Holiday"}

    # Validate employee ID
    try:
        employee_id = int(employee_id)
        if employee_id <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid employee ID.")
        return False

    # Validate date
    try:
        if isinstance(attendance_date, datetime):
            attendance_date = attendance_date.date()
        elif isinstance(attendance_date, str):
            attendance_date = date.fromisoformat(attendance_date)

        if not isinstance(attendance_date, date):
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid date. Use YYYY-MM-DD.")
        return False

    # Validate status
    if attendance_status not in valid_statuses:
        print("Invalid status. Choose Present, Absent, Half Day, or Holiday.")
        return False

    # Validate times
    try:
        if isinstance(check_in, str):
            check_in = time.fromisoformat(check_in)
        if isinstance(check_out, str):
            check_out = time.fromisoformat(check_out)

        if check_in is not None and not isinstance(check_in, time):
            raise ValueError
        if check_out is not None and not isinstance(check_out, time):
            raise ValueError

        if check_in and check_out and check_out < check_in:
            print("Check-out time cannot be earlier than check-in time.")
            return False

    except (ValueError, TypeError):
        print("Invalid time. Use HH:MM or HH:MM:SS.")
        return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Confirm that the employee exists and is active.
        cursor.execute(
            """
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
              AND employment_status = 'Active'
            """,
            (employee_id,)
        )

        if cursor.fetchone() is None:
            print("Active employee not found.")
            return False

        # Prevent duplicate attendance for the same date.
        cursor.execute(
            """
            SELECT attendance_id
            FROM attendance
            WHERE employee_id = %s AND attendance_date = %s
            """,
            (employee_id, attendance_date)
        )

        if cursor.fetchone() is not None:
            print(
                "Attendance has already been recorded "
                "for this employee on this date."
            )
            return False

        # Insert the attendance record.
        cursor.execute(
            """
            INSERT INTO attendance (
                employee_id, attendance_date,
                check_in, check_out, attendance_status
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                employee_id, attendance_date,
                check_in, check_out, attendance_status
            )
        )

        connection.commit()
        print("Attendance recorded successfully.")
        return True

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def view_attendance(session, employee_id=None, attendance_date=None):
    """View attendance with session-based access control."""

    # Only authenticated users with an allowed role may continue.
    try:
        require_session_role(session, ["Admin", "HR", "Employee"])
    except PermissionError as error:
        print(error)
        return False

    # Employees can view only their own attendance.
    if session.access_role == "Employee":
        if employee_id is not None:
            try:
                requested_id = int(employee_id)
            except (ValueError, TypeError):
                print("Invalid employee ID.")
                return False

            if requested_id != session.employee_id:
                print("Employees can view only their own attendance.")
                return False

        # Force the query to use the logged-in employee's ID.
        employee_id = session.employee_id

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
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
        """

        parameters = []

        # Optional employee filter
        if employee_id is not None:
            try:
                employee_id = int(employee_id)
                if employee_id <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                print("Invalid employee ID.")
                return False

            query += " AND a.employee_id = %s"
            parameters.append(employee_id)

        # Optional date filter
        if attendance_date is not None:
            try:
                if isinstance(attendance_date, datetime):
                    attendance_date = attendance_date.date()
                elif isinstance(attendance_date, str):
                    attendance_date = date.fromisoformat(attendance_date)

                if not isinstance(attendance_date, date):
                    raise ValueError

            except (ValueError, TypeError):
                print("Invalid date. Use YYYY-MM-DD.")
                return False

            query += " AND a.attendance_date = %s"
            parameters.append(attendance_date)

        query += " ORDER BY a.attendance_date DESC, a.employee_id"

        cursor.execute(query, tuple(parameters))
        records = cursor.fetchall()

        if not records:
            print("No attendance records found.")
            return []

        for record in records:
            print("-" * 45)
            print("Attendance ID:", record["attendance_id"])
            print("Employee ID:", record["employee_id"])
            print("Employee Name:", record["employee_name"])
            print("Date:", record["attendance_date"])
            print("Check-in:", record["check_in"])
            print("Check-out:", record["check_out"])
            print("Status:", record["attendance_status"])

        print("-" * 45)
        print("Total records:", len(records))

        return records

    except Error as error:
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def monthly_attendance_summary(session, employee_id, year, month):
    """Display a monthly attendance summary with access control."""

    # Check login and role.
    try:
        require_session_role(session, ["Admin", "HR", "Employee"])
    except PermissionError as error:
        print(error)
        return False

    # Employees can view only their own summary.
    if session.access_role == "Employee":
        try:
            requested_id = int(employee_id)
        except (ValueError, TypeError):
            print("Invalid employee ID.")
            return False

        if requested_id != session.employee_id:
            print("Employees can view only their own attendance summary.")
            return False

        employee_id = session.employee_id

    connection = None
    cursor = None

    # Validate employee ID.
    try:
        employee_id = int(employee_id)
        if employee_id <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid employee ID.")
        return False

    # Validate year and month.
    try:
        year = int(year)
        month = int(month)

        if year < 1 or year > 9999 or month < 1 or month > 12:
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid year or month.")
        return False

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # Confirm that the employee exists.
        cursor.execute(
            """
            SELECT first_name, last_name
            FROM employees
            WHERE employee_id = %s
            """,
            (employee_id,)
        )

        employee = cursor.fetchone()

        if employee is None:
            print("Employee not found.")
            return False

        # Calculate attendance statistics for the selected month.
        next_year = year + 1 if month == 12 else year
        next_month = 1 if month == 12 else month + 1

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_days_recorded,
                COALESCE(SUM(attendance_status = 'Present'), 0)
                    AS present_days,
                COALESCE(SUM(attendance_status = 'Absent'), 0)
                    AS absent_days,
                COALESCE(SUM(attendance_status = 'Half Day'), 0)
                    AS half_days,
                COALESCE(SUM(attendance_status = 'Holiday'), 0)
                    AS holidays
            FROM attendance
            WHERE employee_id = %s
              AND attendance_date >= %s
              AND attendance_date < %s
            """,
            (
                employee_id,
                f"{year:04d}-{month:02d}-01",
                f"{next_year:04d}-{next_month:02d}-01"
            )
        )

        summary = cursor.fetchone()

        print("\nMONTHLY ATTENDANCE SUMMARY")
        print("-" * 35)
        print(
            "Employee:",
            employee["first_name"],
            employee["last_name"]
        )
        print("Employee ID:", employee_id)
        print(f"Month: {year:04d}-{month:02d}")
        print("Days recorded:", summary["total_days_recorded"])
        print("Present:", summary["present_days"])
        print("Absent:", summary["absent_days"])
        print("Half Days:", summary["half_days"])
        print("Holidays:", summary["holidays"])
        print("-" * 35)

        return summary

    except Error as error:
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()



def apply_for_leave(session, leave_type, start_date, end_date, reason=None):
    """Allow an authenticated employee to apply for their own leave."""

    try:
        require_session_role(session, ["Admin", "HR", "Employee"])
    except PermissionError as error:
        print(error)
        return False

    employee_id = session.employee_id

    if not isinstance(leave_type, str) or not leave_type.strip():
        print("Leave type is required.")
        return False

    if isinstance(start_date, str):
        try:
            start_date = date.fromisoformat(start_date)
        except ValueError:
            print("Invalid start date. Use YYYY-MM-DD.")
            return False

    if isinstance(end_date, str):
        try:
            end_date = date.fromisoformat(end_date)
        except ValueError:
            print("Invalid end date. Use YYYY-MM-DD.")
            return False

    if not isinstance(start_date, date) or not isinstance(end_date, date):
        print("Start date and end date must be valid dates.")
        return False

    if end_date < start_date:
        print("End date cannot be before start date.")
        return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        if connection is None:
            return False

        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO leave_requests
                (employee_id, leave_type, start_date, end_date, reason)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                employee_id,
                leave_type.strip(),
                start_date,
                end_date,
                reason,
            ),
        )

        connection.commit()
        print(f"Leave request submitted successfully. Leave ID: {cursor.lastrowid}")
        return True

    except Error as error:
        if connection is not None:
            connection.rollback()
        print(f"Database error while applying for leave: {error}")
        return False

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


def view_leave_requests(session, employee_id=None, leave_status=None):
    """Display leave requests with session-based access control."""

    # Verify that the user is authenticated and has an allowed role.
    try:
        require_session_role(session, ["Admin", "HR", "Employee"])
    except PermissionError as error:
        print(error)
        return False

    # Employees can view only their own leave requests.
    if session.access_role == "Employee":
        if employee_id is not None:
            try:
                requested_id = int(employee_id)
            except (ValueError, TypeError):
                print("Invalid employee ID.")
                return False

            if requested_id != session.employee_id:
                print("Employees can view only their own leave requests.")
                return False

        # Enforce the employee ID from the authenticated session.
        employee_id = session.employee_id

    valid_statuses = {"Pending", "Approved", "Rejected"}

    # Validate optional employee ID.
    if employee_id is not None:
        try:
            employee_id = int(employee_id)
            if employee_id <= 0:
                raise ValueError
        except (ValueError, TypeError):
            print("Invalid employee ID.")
            return False

    # Validate optional leave status.
    if leave_status is not None:
        if leave_status not in valid_statuses:
            print("Invalid leave status.")
            return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                l.leave_id,
                l.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                l.leave_type,
                l.start_date,
                l.end_date,
                l.reason,
                l.leave_status,
                l.reviewed_by,
                CONCAT(r.first_name, ' ', r.last_name) AS reviewer_name,
                l.reviewed_at,
                l.applied_at
            FROM leave_requests l
            JOIN employees e
                ON l.employee_id = e.employee_id
            LEFT JOIN employees r
                ON l.reviewed_by = r.employee_id
            WHERE 1 = 1
        """

        parameters = []

        if employee_id is not None:
            query += " AND l.employee_id = %s"
            parameters.append(employee_id)

        if leave_status is not None:
            query += " AND l.leave_status = %s"
            parameters.append(leave_status)

        query += " ORDER BY l.applied_at DESC, l.leave_id DESC"

        cursor.execute(query, tuple(parameters))
        records = cursor.fetchall()

        if not records:
            print("No leave requests found.")
            return []

        for record in records:
            print("-" * 45)
            print("Leave ID:", record["leave_id"])
            print("Employee:", record["employee_name"])
            print("Employee ID:", record["employee_id"])
            print("Leave Type:", record["leave_type"])
            print("Start Date:", record["start_date"])
            print("End Date:", record["end_date"])
            print("Reason:", record["reason"])
            print("Status:", record["leave_status"])
            print("Reviewed By:", record["reviewer_name"])
            print("Reviewed At:", record["reviewed_at"])

        print("-" * 45)
        print("Total requests:", len(records))

        return records

    except Error as error:
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def generate_payroll(
    session,
    employee_id,
    pay_month,
    basic_salary,
    allowances=0,
    deductions=0
):
    """Generate a payroll record for an employee for a given month."""

    # Only Admin and HR can generate payroll
    try:
        require_session_role(session, ["Admin", "HR"])
    except PermissionError as error:
        print(error)
        return False

    # Validate employee ID
    try:
        employee_id = int(employee_id)
        if employee_id <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid employee ID.")
        return False

    # Validate the payroll month
    try:
        if isinstance(pay_month, datetime):
            pay_month = pay_month.date()
        elif isinstance(pay_month, str):
            pay_month = date.fromisoformat(pay_month)

        if not isinstance(pay_month, date):
            raise ValueError

        # Payroll months must be represented by their first day
        if pay_month.day != 1:
            raise ValueError

    except (ValueError, TypeError):
        print("Invalid payroll month. Use YYYY-MM-01, such as 2026-11-01.")
        return False

    # Validate monetary amounts
    try:
        amounts = []

        for value in (basic_salary, allowances, deductions):
            amount = Decimal(str(value))

            if not amount.is_finite() or amount < 0:
                raise ValueError

            # Database columns support at most 2 decimal places
            if amount.as_tuple().exponent < -2:
                raise ValueError

            if amount >= Decimal("100000000"):
                raise ValueError

            amounts.append(amount)

        basic_salary, allowances, deductions = amounts

        if basic_salary + allowances < deductions:
            print("Deductions cannot exceed basic salary plus allowances.")
            return False

    except (ValueError, TypeError, InvalidOperation):
        print("Invalid salary amount. Use non-negative amounts with at most 2 decimal places.")
        return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Confirm the employee exists
        cursor.execute(
            "SELECT employee_id FROM employees WHERE employee_id = %s",
            (employee_id,)
        )

        if cursor.fetchone() is None:
            print("Employee not found.")
            return False

        # Prevent duplicate payroll for the same employee and month
        cursor.execute(
            """
            SELECT payroll_id
            FROM payroll
            WHERE employee_id = %s AND pay_month = %s
            """,
            (employee_id, pay_month)
        )

        if cursor.fetchone() is not None:
            print("Payroll already exists for this employee and month.")
            return False

        # Insert the payroll record.
        # net_salary is calculated automatically by MySQL.
        cursor.execute(
            """
            INSERT INTO payroll (
                employee_id,
                pay_month,
                basic_salary,
                allowances,
                deductions
            )
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                employee_id,
                pay_month,
                basic_salary,
                allowances,
                deductions
            )
        )

        payroll_id = cursor.lastrowid
        connection.commit()

        print("Payroll generated successfully.")
        print("Payroll ID:", payroll_id)
        print("Payment status: Pending")
        print("Net salary:", basic_salary + allowances - deductions)

        return payroll_id

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def view_payroll(session, employee_id=None, pay_month=None):
    """Display payroll records according to the logged-in user's role."""

    # Validate the session and authorize the user's role
    try:
        require_session_role(session, ["Admin", "HR", "Employee"])
    except PermissionError as error:
        print(error)
        return False

    # Employees can view only their own payroll records
    if session.access_role == "Employee":
        if employee_id is not None:
            try:
                requested_id = int(employee_id)
            except (ValueError, TypeError):
                print("Invalid employee ID.")
                return False

            if requested_id != session.employee_id:
                print("Employees can view only their own payroll records.")
                return False

        employee_id = session.employee_id

    # Validate optional employee ID
    if employee_id is not None:
        try:
            employee_id = int(employee_id)
            if employee_id <= 0:
                raise ValueError
        except (ValueError, TypeError):
            print("Invalid employee ID.")
            return False

    # Validate optional payroll month
    if pay_month is not None:
        try:
            if isinstance(pay_month, datetime):
                pay_month = pay_month.date()
            elif isinstance(pay_month, str):
                pay_month = date.fromisoformat(pay_month)

            if not isinstance(pay_month, date) or pay_month.day != 1:
                raise ValueError

        except (ValueError, TypeError):
            print("Invalid payroll month. Use YYYY-MM-01.")
            return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
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
        """

        parameters = []

        if employee_id is not None:
            query += " AND p.employee_id = %s"
            parameters.append(employee_id)

        if pay_month is not None:
            query += " AND p.pay_month = %s"
            parameters.append(pay_month)

        query += " ORDER BY p.pay_month DESC, p.employee_id"

        cursor.execute(query, tuple(parameters))
        records = cursor.fetchall()

        if not records:
            print("No payroll records found.")
            return []

        for record in records:
            print("-" * 45)
            print("Payroll ID:", record["payroll_id"])
            print("Employee:", record["employee_name"])
            print("Employee ID:", record["employee_id"])
            print("Pay Month:", record["pay_month"])
            print("Basic Salary:", record["basic_salary"])
            print("Allowances:", record["allowances"])
            print("Deductions:", record["deductions"])
            print("Net Salary:", record["net_salary"])
            print("Payment Status:", record["payment_status"])
            print("Payment Date:", record["payment_date"])

        print("-" * 45)
        print("Total payroll records:", len(records))

        return records

    except Error as error:
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def update_payroll_status(session, payroll_id, new_status):
    """Update a payroll payment status. Admin and HR only."""

    try:
        require_session_role(session, ["Admin", "HR"])
    except PermissionError as error:
        print(error)
        return False

    # Validate payroll ID
    try:
        payroll_id = int(payroll_id)
        if payroll_id <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid payroll ID.")
        return False

    # Validate payment status
    allowed_statuses = ["Pending", "Paid", "On Hold"]

    if not isinstance(new_status, str):
        print("Invalid payment status.")
        return False

    new_status = new_status.strip().title()

    if new_status not in allowed_statuses:
        print("Invalid payment status.")
        print("Allowed statuses:", ", ".join(allowed_statuses))
        return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Confirm the payroll record exists
        cursor.execute(
            "SELECT payroll_id FROM payroll WHERE payroll_id = %s",
            (payroll_id,)
        )

        if cursor.fetchone() is None:
            print("Payroll record not found.")
            return False

        # Record payment date only when the status is Paid
        if new_status == "Paid":
            cursor.execute(
                """
                UPDATE payroll
                SET payment_status = %s,
                    payment_date = CURRENT_DATE
                WHERE payroll_id = %s
                """,
                (new_status, payroll_id)
            )
        else:
            cursor.execute(
                """
                UPDATE payroll
                SET payment_status = %s,
                    payment_date = NULL
                WHERE payroll_id = %s
                """,
                (new_status, payroll_id)
            )

        connection.commit()

        print(
            f"Payroll ID {payroll_id} status updated to "
            f"{new_status}."
        )
        return True

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()
        print("Database error:", error)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def hash_password(password):
    """Return a bcrypt hash for a password."""

    if not isinstance(password, str) or not password:
        raise ValueError("Password cannot be empty.")

    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError(
            "Password must not exceed 72 UTF-8 bytes."
        )

    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password_bytes, salt)

    return hashed_password.decode("utf-8")


def verify_password(password, stored_hash):
    """Check whether a password matches its stored bcrypt hash."""

    if not isinstance(password, str):
        return False

    if not isinstance(stored_hash, str):
        return False

    try:
        password_bytes = password.encode("utf-8")

        if len(password_bytes) > 72:
            return False

        return bcrypt.checkpw(
            password_bytes,
            stored_hash.encode("utf-8")
        )

    except (ValueError, TypeError):
        return False


def create_user_account(
    session,
    employee_id,
    username,
    password,
    access_role="Employee"
):
    """Create an account with role-based authorization."""

    # Only Admin and HR may create accounts.
    try:
        require_session_role(session, ["Admin", "HR"])
    except PermissionError as error:
        print(error)
        return False

    # Validate employee ID
    try:
        employee_id = int(employee_id)
        if employee_id <= 0:
            raise ValueError
    except (ValueError, TypeError):
        print("Invalid employee ID.")
        return False

    # Validate username
    if not isinstance(username, str):
        print("Invalid username.")
        return False

    username = username.strip()

    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,50}", username):
        print(
            "Username must contain 3-50 characters: "
            "letters, numbers, underscores, dots or hyphens."
        )
        return False

    # Validate password
    if not isinstance(password, str) or len(password) < 8:
        print("Password must contain at least 8 characters.")
        return False

    if len(password.encode("utf-8")) > 72:
        print("Password must not exceed 72 UTF-8 bytes.")
        return False

    # Validate and normalize role
    if not isinstance(access_role, str):
        print("Invalid account role.")
        return False

    role_map = {
        "admin": "Admin",
        "hr": "HR",
        "employee": "Employee"
    }

    access_role = role_map.get(access_role.strip().lower())

    if access_role is None:
        print("Invalid account role.")
        return False

    # Only Admin may create HR or Admin accounts.
    if (
        access_role in ("Admin", "HR")
        and session.access_role != "Admin"
    ):
        print("Only Admin can create HR or Admin accounts.")
        return False

    # Hash password
    try:
        password_hash = hash_password(password)
    except ValueError as error:
        print(error)
        return False

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Confirm employee exists and is active.
        cursor.execute(
            """
            SELECT employee_id
            FROM employees
            WHERE employee_id = %s
              AND employment_status = 'Active'
            """,
            (employee_id,)
        )

        if cursor.fetchone() is None:
            print("Active employee not found.")
            return False

        # Insert account
        cursor.execute(
            """
            INSERT INTO user_accounts
                (employee_id, username, password_hash, access_role)
            VALUES (%s, %s, %s, %s)
            """,
            (employee_id, username, password_hash, access_role)
        )

        connection.commit()

        print("User account created successfully.")
        print("Username:", username)
        print("Role:", access_role)
        return True

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        if error.errno == 1062:
            print(
                "Account creation failed: this employee or "
                "username already has an account."
            )
        else:
            print("Database error:", error)

        return False

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()

def login_user(username, password):
    """Authenticate an active user account."""

    if not isinstance(username, str) or not isinstance(password, str):
        print("Invalid username or password.")
        return None

    username = username.strip()

    if not username or not password:
        print("Invalid username or password.")
        return None

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
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
            WHERE ua.username = %s
            """,
            (username,)
        )

        account = cursor.fetchone()

        # Use the same general error for unknown users and bad passwords.
        if account is None:
            print("Invalid username or password.")
            return None

        if not verify_password(password, account["password_hash"]):
            print("Invalid username or password.")
            return None

        if account["account_status"] != "Active":
            print("This account is disabled.")
            return None

        # Record the successful login time.
        cursor.execute(
            """
            UPDATE user_accounts
            SET last_login = CURRENT_TIMESTAMP
            WHERE account_id = %s
            """,
            (account["account_id"],)
        )

        connection.commit()

        # Do not expose the stored password hash to the caller.
        account.pop("password_hash", None)

        print("Login successful.")
        return account

    except Error as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("Database error:", error)
        return None

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()

class UserSession:
    """Represent a successfully authenticated user."""

    def __init__(
        self,
        account_id,
        employee_id,
        username,
        access_role,
        employee_name
    ):
        self.account_id = account_id
        self.employee_id = employee_id
        self.username = username
        self.access_role = access_role
        self.employee_name = employee_name
        self.is_authenticated = True

def create_session(user_details):
    """Create a session from successful login details."""

    if not isinstance(user_details, dict):
        return None

    required_fields = [
        "account_id",
        "employee_id",
        "username",
        "access_role"
    ]

    if not all(field in user_details for field in required_fields):
        return None

    if user_details["access_role"] not in ["Admin", "HR", "Employee"]:
        return None

    session = UserSession(
    account_id=user_details["account_id"],
    employee_id=user_details["employee_id"],
    username=user_details["username"],
    access_role=user_details["access_role"],
    employee_name=user_details["employee_name"]
)
    return session


def require_session_role(session, allowed_roles):
    """Require an authenticated session with an allowed role."""

    if not isinstance(session, UserSession):
        raise PermissionError("Access denied. Please log in.")

    if not session.is_authenticated:
        raise PermissionError("Access denied. Please log in.")

    if session.access_role not in allowed_roles:
        raise PermissionError(
            "Access denied. You do not have permission "
            "to perform this operation."
        )

    return True


# ============================================================
# ADDITIONAL BACKEND FUNCTIONS FOR STREAMLIT
# ============================================================


# 1. GET DEPARTMENTS FOR DROPDOWN MENUS

def get_departments():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT department_id, department_name
            FROM departments
            ORDER BY department_name
        """)

        return cursor.fetchall()

    except Error as e:
        print("Error retrieving departments:", e)
        return []

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# 2. GET JOB ROLES FOR DROPDOWN MENUS

def get_job_roles():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT role_id, role_title
            FROM job_roles
            ORDER BY role_title
        """)

        return cursor.fetchall()

    except Error as e:
        print("Error retrieving job roles:", e)
        return []

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# 3. GET ACTIVE EMPLOYEES FOR MANAGER DROPDOWN

def get_active_employees_for_dropdown():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT employee_id,
                   CONCAT(first_name, ' ', last_name) AS employee_name
            FROM employees
            WHERE employment_status = 'Active'
            ORDER BY first_name, last_name
        """)

        return cursor.fetchall()

    except Error as e:
        print("Error retrieving employees:", e)
        return []

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# 4. APPROVE OR REJECT LEAVE REQUESTS

def review_leave_request(session, leave_id, decision):

    require_session_role(session, ["Admin", "HR"])

    if decision not in ["Approved", "Rejected"]:
        raise ValueError("Invalid leave decision.")

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            UPDATE leave_requests
            SET leave_status = %s,
                reviewed_by = %s,
                reviewed_at = CURRENT_TIMESTAMP
            WHERE leave_id = %s
              AND leave_status = 'Pending'
        """, (decision, session.employee_id, leave_id))

        connection.commit()

        return cursor.rowcount > 0

    except Error as e:
        if connection:
            connection.rollback()
        print("Error reviewing leave request:", e)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# 5. VIEW USER ACCOUNTS

def view_user_accounts(session):

    require_session_role(session, ["Admin", "HR"])

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                ua.account_id,
                ua.employee_id,
                CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
                ua.username,
                ua.access_role,
                ua.account_status,
                ua.created_at,
                ua.last_login
            FROM user_accounts ua
            JOIN employees e
                ON ua.employee_id = e.employee_id
            ORDER BY ua.account_id
        """)

        return cursor.fetchall()

    except Error as e:
        print("Error retrieving user accounts:", e)
        return []

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# 6. ACTIVATE OR DEACTIVATE USER ACCOUNTS

def update_user_account_status(session, account_id, new_status):

    require_session_role(session, ["Admin"])

    if new_status not in ["Active", "Inactive"]:
        raise ValueError("Invalid account status.")

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        # Prevent the currently logged-in admin from disabling their own account.
        if account_id == session.account_id and new_status == "Inactive":
            raise ValueError("You cannot deactivate your own account.")

        cursor.execute("""
            UPDATE user_accounts
            SET account_status = %s
            WHERE account_id = %s
        """, (new_status, account_id))

        connection.commit()

        return cursor.rowcount > 0

    except (Error, ValueError) as e:
        if connection:
            connection.rollback()
        print("Error updating account status:", e)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# 7. CHANGE USER ACCOUNT ROLE

def update_user_account_role(session, account_id, new_role):

    require_session_role(session, ["Admin"])

    if new_role not in ["Admin", "HR", "Employee"]:
        raise ValueError("Invalid access role.")

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT account_id, access_role
            FROM user_accounts
            WHERE account_id = %s
        """, (account_id,))

        target_account = cursor.fetchone()

        if not target_account:
            return False

        # Prevent the logged-in admin from demoting their own account.
        if account_id == session.account_id and new_role != "Admin":
            raise ValueError("You cannot change your own Admin role.")

        # Prevent removal of the last active Admin account.
        if target_account["access_role"] == "Admin" and new_role != "Admin":

            cursor.execute("""
                SELECT COUNT(*) AS admin_count
                FROM user_accounts
                WHERE access_role = 'Admin'
                  AND account_status = 'Active'
            """)

            admin_count = cursor.fetchone()["admin_count"]

            if admin_count <= 1:
                raise ValueError("At least one active Admin account must remain.")

        cursor.execute("""
            UPDATE user_accounts
            SET access_role = %s
            WHERE account_id = %s
        """, (new_role, account_id))

        connection.commit()

        return cursor.rowcount > 0

    except (Error, ValueError) as e:
        if connection:
            connection.rollback()
        print("Error updating account role:", e)
        return False

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
