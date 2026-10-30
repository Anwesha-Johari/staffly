
from employee_backend import (
    login_user,
    create_session,
    view_attendance,
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


print("\nTEST 1: David views his own attendance")
records1 = view_attendance(session=david_session)

# All returned records must belong to David.
passed1 = (
    isinstance(records1, list)
    and all(record["employee_id"] == david_session.employee_id
            for record in records1)
)
print("Passed:", passed1)


print("\nTEST 2: David views his attendance by employee ID")
records2 = view_attendance(
    session=david_session,
    employee_id=4
)

passed2 = (
    isinstance(records2, list)
    and all(record["employee_id"] == 4 for record in records2)
)
print("Passed:", passed2)


print("\nTEST 3: David filters his attendance by date")
records3 = view_attendance(
    session=david_session,
    attendance_date="2026-10-29"
)

passed3 = (
    isinstance(records3, list)
    and all(
        record["employee_id"] == david_session.employee_id
        and str(record["attendance_date"]) == "2026-10-29"
        for record in records3
    )
)
print("Passed:", passed3)


print("\nTEST 4: David cannot view Alice's attendance")
result4 = view_attendance(
    session=david_session,
    employee_id=1
)
print("Passed:", result4 is False)
