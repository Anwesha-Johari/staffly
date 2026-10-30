
from employee_backend import (
    login_user,
    create_session,
    view_active_employees
)
from contextlib import redirect_stdout
from io import StringIO
from getpass import getpass

print("\n--- Employee Status Access Tests ---")

# Test 1: Missing session
output = StringIO()

with redirect_stdout(output):
    view_active_employees(None)

if "Access denied" in output.getvalue():
    print("PASS: Missing session rejected.")
else:
    print("FAIL: Missing session test.")

# Test 2: Employee access
employee_details = login_user(
    "david_test",
    "DemoPassword!482"
)
employee_session = create_session(employee_details)

output = StringIO()

with redirect_stdout(output):
    view_active_employees(employee_session)

if "Access denied" in output.getvalue():
    print("PASS: Employee access rejected.")
else:
    print("FAIL: Employee access test.")

# Test 3: Admin access
admin_password = getpass("Enter your Admin password: ")
admin_details = login_user("abc", admin_password)
admin_session = create_session(admin_details)

output = StringIO()

with redirect_stdout(output):
    view_active_employees(admin_session)

if "--- Active Employees ---" in output.getvalue():
    print("PASS: Admin access accepted.")
else:
    print("FAIL: Admin access test.")

print("\n--- Tests Completed ---")
