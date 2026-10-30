
from employee_backend import (
    login_user,
    create_session,
    view_leave_requests,
)

# Log in as David
david_details = login_user(
    "david_test",
    "DemoPassword!482"
)

if not david_details:
    print("Login failed. Test stopped.")
    raise SystemExit(1)

david_session = create_session(david_details)

if not david_session:
    print("Session creation failed. Test stopped.")
    raise SystemExit(1)


print("\nTEST 1: David views his own leave requests")
records1 = view_leave_requests(session=david_session)

passed1 = (
    isinstance(records1, list)
    and all(record["employee_id"] == david_session.employee_id
            for record in records1)
)
print("Passed:", passed1)


print("\nTEST 2: David filters his own leave requests")
records2 = view_leave_requests(
    session=david_session,
    employee_id=4
)

passed2 = (
    isinstance(records2, list)
    and all(record["employee_id"] == 4 for record in records2)
)
print("Passed:", passed2)


print("\nTEST 3: David views his pending requests")
records3 = view_leave_requests(
    session=david_session,
    leave_status="Pending"
)

passed3 = (
    isinstance(records3, list)
    and all(
        record["employee_id"] == david_session.employee_id
        and record["leave_status"] == "Pending"
        for record in records3
    )
)
print("Passed:", passed3)


print("\nTEST 4: Invalid leave status")
result4 = view_leave_requests(
    session=david_session,
    leave_status="Waiting"
)
print("Passed:", result4 is False)


print("\nTEST 5: David cannot view Alice's leave requests")
result5 = view_leave_requests(
    session=david_session,
    employee_id=1
)
print("Passed:", result5 is False)


print("\nTEST 6: Missing session is rejected")
result6 = view_leave_requests(
    session=None
)
print("Passed:", result6 is False)
