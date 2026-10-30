
from employee_backend import login_user, create_session, search_employee

# Log in using existing development accounts.
admin_details = login_user("abc", input("Enter Admin password: "))
hr_details = login_user("alice_hr_test", "DevHRPassword!482")
employee_details = login_user("david_test", "DemoPassword!482")

if not admin_details or not hr_details or not employee_details:
    print("Login failed. Tests stopped.")
    raise SystemExit(1)

admin_session = create_session(admin_details)
hr_session = create_session(hr_details)
employee_session = create_session(employee_details)

if not admin_session or not hr_session or not employee_session:
    print("Session creation failed. Tests stopped.")
    raise SystemExit(1)


def run_test(description, condition):
    print(f"{description}: {'Passed' if condition else 'FAILED'}")


print("\n--- Employee Search Tests ---")

# 1. Admin can search for Alice by ID.
result = search_employee(admin_session, "1")
run_test(
    "Admin can search by employee ID",
    isinstance(result, dict) and result["employee_id"] == 1
)

# 2. HR can search for David by name.
result = search_employee(hr_session, "David Taylor")
run_test(
    "HR can search by full name",
    isinstance(result, dict) and result["employee_id"] == 4
)

# 3. Admin can search by email.
result = search_employee(admin_session, "alice.morgan@example.com")
run_test(
    "Admin can search by email",
    isinstance(result, dict) and result["employee_id"] == 1
)

# 4. Employee can search for their own ID.
result = search_employee(employee_session, "4")
run_test(
    "Employee can search for their own record",
    isinstance(result, dict) and result["employee_id"] == 4
)

# 5. Employee cannot search for Alice by ID.
result = search_employee(employee_session, "1")
run_test(
    "Employee cannot search for another employee by ID",
    result is None
)

# 6. Employee cannot search for another employee by name.
result = search_employee(employee_session, "Alice")
run_test(
    "Employee cannot search by another employee's name",
    result is None
)

# 7. Employee cannot search by another employee's email.
result = search_employee(
    employee_session,
    "alice.morgan@example.com"
)
run_test(
    "Employee cannot search by another employee's email",
    result is None
)

# 8. Empty search input is rejected.
result = search_employee(admin_session, "   ")
run_test(
    "Empty search input is rejected",
    result is None
)

# 9. Missing session is rejected.
result = search_employee(None, "1")
run_test(
    "Missing session is rejected",
    result is None
)
