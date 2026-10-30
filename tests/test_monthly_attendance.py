\
from employee_backend import (
    login_user,
    create_session,
    monthly_attendance_summary,
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


print("\nTEST 1: David's October 2026 summary")
result1 = monthly_attendance_summary(
    session=david_session,
    employee_id=4,
    year=2026,
    month=10
)
print("Returned a summary:", isinstance(result1, dict))


print("\nTEST 2: David's September 2026 summary")
result2 = monthly_attendance_summary(
    session=david_session,
    employee_id=4,
    year=2026,
    month=9
)
print("Returned a summary:", isinstance(result2, dict))


print("\nTEST 3: Nonexistent employee")
result3 = monthly_attendance_summary(
    session=david_session,
    employee_id=999,
    year=2026,
    month=10
)
print("Passed:", result3 is False)


print("\nTEST 4: David cannot view Alice's summary")
result4 = monthly_attendance_summary(
    session=david_session,
    employee_id=1,
    year=2026,
    month=10
)
print("Passed:", result4 is False)
