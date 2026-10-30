
from employee_backend import (
    login_user,
    create_session,
    require_session_role
)

print("\nTEST 1: Create session after successful login")

user_details = login_user(
    "david_test",
    "DemoPassword!482"
)

session = create_session(user_details)

print("Passed:", session is not None)

if session:
    print("Username:", session.username)
    print("Employee ID:", session.employee_id)
    print("Role:", session.access_role)


print("\nTEST 2: Employee can access employee-level operations")

try:
    require_session_role(session, ["Employee", "HR", "Admin"])
    print("Passed: True")
except PermissionError as error:
    print("Passed: False", error)


print("\nTEST 3: Employee cannot access HR/Admin-only operations")

try:
    require_session_role(session, ["HR", "Admin"])
    print("Passed: False")
except PermissionError:
    print("Passed: True")


print("\nTEST 4: Missing session is rejected")

try:
    require_session_role(None, ["HR", "Admin"])
    print("Passed: False")
except PermissionError:
    print("Passed: True")


print("\nTEST 5: Invalid user details cannot create a session")

invalid_session = create_session({
    "username": "fake_user",
    "access_role": "Admin"
})

print("Passed:", invalid_session is None)
