
from employee_backend import (
    login_user,
    create_session,
    view_payroll
)

# Log in as HR
alice_details = login_user(
    "alice_hr_test",
    "DevHRPassword!482"
)
alice_session = create_session(alice_details) if alice_details else None

# Log in as Employee
david_details = login_user(
    "david_test",
    "DemoPassword!482"
)
david_session = create_session(david_details) if david_details else None


if not alice_session or not david_session:
    print("Login or session creation failed. Cannot continue tests.")
    raise SystemExit(1)


print("\nTEST 1: HR views all payroll records")
result1 = view_payroll(session=alice_session)
passed1 = isinstance(result1, list) and len(result1) >= 1
print("Passed:", passed1)


print("\nTEST 2: HR views David Taylor's payroll")
result2 = view_payroll(session=alice_session, employee_id=4)
passed2 = (
    isinstance(result2, list)
    and len(result2) >= 1
    and all(record["employee_id"] == 4 for record in result2)
)
print("Passed:", passed2)


print("\nTEST 3: HR filters November 2026 payroll")
result3 = view_payroll(
    session=alice_session,
    pay_month="2026-11-01"
)
passed3 = (
    isinstance(result3, list)
    and all(str(record["pay_month"]) == "2026-11-01"
            for record in result3)
)
print("Passed:", passed3)


print("\nTEST 4: Invalid employee ID")
result4 = view_payroll(session=alice_session, employee_id=-1)
print("Passed:", result4 is False)


print("\nTEST 5: Invalid payroll month")
result5 = view_payroll(
    session=alice_session,
    pay_month="2026-11-15"
)
print("Passed:", result5 is False)


print("\nTEST 6: David views his own payroll")
result6 = view_payroll(session=david_session)
passed6 = (
    isinstance(result6, list)
    and all(record["employee_id"] == david_session.employee_id
            for record in result6)
)
print("Passed:", passed6)


print("\nTEST 7: David filters his own payroll")
result7 = view_payroll(session=david_session, employee_id=4)
passed7 = (
    isinstance(result7, list)
    and all(record["employee_id"] == 4 for record in result7)
)
print("Passed:", passed7)


print("\nTEST 8: David attempts to view Alice's payroll")
result8 = view_payroll(session=david_session, employee_id=1)
print("Passed:", result8 is False)


print("\nTEST 9: Missing session is rejected")
result9 = view_payroll(session=None)
print("Passed:", result9 is False)
