

from employee_backend import (
    login_user,
    create_session,
    mark_attendance,
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

# Record attendance for David using his own session.
result = mark_attendance(
    session=david_session,
    employee_id=4,
    attendance_date="2026-10-30",
    attendance_status="Present",
    check_in="09:00",
    check_out="17:00"
)

print("Attendance result:", result)


print("\nTEST: Employee cannot record attendance for another employee")

unauthorized_result = mark_attendance(
    session=david_session,
    employee_id=1,
    attendance_date="2026-10-31",
    attendance_status="Present",
    check_in="09:00",
    check_out="17:00"
)

print("Passed:", unauthorized_result is False)
