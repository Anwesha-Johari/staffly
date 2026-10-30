
from employee_backend import (
    login_user,
    create_session,
    update_employee
)

# Log in using existing development accounts.
hr_details = login_user(
    "alice_hr_test",
    "DevHRPassword!482"
)

employee_details = login_user(
    "david_test",
    "DemoPassword!482"
)

if not hr_details or not employee_details:
    print("Login failed. Tests stopped.")
    raise SystemExit(1)

hr_session = create_session(hr_details)
employee_session = create_session(employee_details)

if not hr_session or not employee_session:
    print("Session creation failed. Tests stopped.")
    raise SystemExit(1)


def run_test(description, result, expected):
    passed = result is expected
    print(f"{description}: {'Passed' if passed else 'FAILED'}")


print("\n--- Update Employee Security Tests ---")

# 1. Missing session must be denied.
result = update_employee(
    session=None,
    employee_id=4,
    first_name="David"
)
run_test("Missing session is rejected", result, False)

# 2. An Employee cannot update employee records.
result = update_employee(
    session=employee_session,
    employee_id=4,
    first_name="David"
)
run_test("Employee cannot update employee records", result, False)

# 3. Invalid email must be rejected before database changes.
result = update_employee(
    session=hr_session,
    employee_id=4,
    email="not-an-email"
)
run_test("Invalid email is rejected", result, False)

# 4. Negative salary must be rejected.
result = update_employee(
    session=hr_session,
    employee_id=4,
    salary=-100
)
run_test("Negative salary is rejected", result, False)

# 5. Invalid employment status must be rejected.
result = update_employee(
    session=hr_session,
    employee_id=4,
    employment_status="Terminated"
)
run_test("Invalid employment status is rejected", result, False)

# 6. Empty update must be rejected.
result = update_employee(
    session=hr_session,
    employee_id=4
)
run_test("Empty update is rejected", result, False)

# 7. Valid email format passes validation.
result = update_employee(
    session=hr_session,
    employee_id=999999,
    email="test.user@example.com"
)
run_test(
    "Valid email format passes validation",
    result,
    False
)