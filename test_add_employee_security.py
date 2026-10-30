
from employee_backend import (
    login_user,
    create_session,
    add_employee
)

admin_details = login_user(
    "abc",
    input("Enter Admin password: ")
)

hr_details = login_user(
    "alice_hr_test",
    "DevHRPassword!482"
)

employee_details = login_user(
    "david_test",
    "DemoPassword!482"
)

if not all([admin_details, hr_details, employee_details]):
    print("Login failed. Tests stopped.")
    raise SystemExit(1)

admin_session = create_session(admin_details)
hr_session = create_session(hr_details)
employee_session = create_session(employee_details)

if not all([admin_session, hr_session, employee_session]):
    print("Session creation failed. Tests stopped.")
    raise SystemExit(1)


# Use an existing email so authorized attempts are rejected
# by the duplicate-email check without inserting a new row.
test_details = {
    "first_name": "David",
    "last_name": "Taylor",
    "email": "david.taylor@example.com",
    "phone": "9000000004",
    "hire_date": "2026-10-29",
    "salary": 45000.00,
    "department_id": 2,
    "role_id": 2,
    "manager_id": 1
}


def attempt_add(session, **details):
    return add_employee(session, **details)


print("\n--- Add Employee Authorization Tests ---")

# 1. Missing session must be denied.
result = attempt_add(None, **test_details)
print("Missing session is rejected:", result is None)

# 2. Employee session must be denied.
result = attempt_add(employee_session, **test_details)
print("Employee cannot add employees:", result is None)

# 3. HR is authorized to attempt adding an employee.
# The duplicate email should prevent an insertion.
result = attempt_add(hr_session, **test_details)
print("HR access accepted; duplicate email safely rejected:", result is None)

# 4. Admin is authorized to attempt adding an employee.
# The duplicate email should prevent an insertion.
result = attempt_add(admin_session, **test_details)
print("Admin access accepted; duplicate email safely rejected:", result is None)
