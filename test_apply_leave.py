
from employee_backend import (
    login_user,
    create_session,
    apply_for_leave,
)

# Log in as David
david_details = login_user("david_test", "DemoPassword!482")

if not david_details:
    print("Login failed. Test stopped.")
    raise SystemExit(1)

david_session = create_session(david_details)

if not david_session:
    print("Session creation failed. Test stopped.")
    raise SystemExit(1)

print("\nTEST 1: End date before start date")
result1 = apply_for_leave(
    session=david_session,
    leave_type="Casual",
    start_date="2026-11-25",
    end_date="2026-11-20",
    reason="Testing invalid dates"
)
print("Passed:", result1 is False)

print("\nTEST 2: Invalid date format")
result2 = apply_for_leave(
    session=david_session,
    leave_type="Sick",
    start_date="25-11-2026",
    end_date="2026-11-26",
    reason="Testing date format"
)
print("Passed:", result2 is False)

print("\nTEST 3: Missing session")
result3 = apply_for_leave(
    session=None,
    leave_type="Casual",
    start_date="2026-11-25",
    end_date="2026-11-26",
    reason="Testing missing session"
)
print("Passed:", result3 is False)
