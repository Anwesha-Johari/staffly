
from employee_backend import (
    login_user,
    create_session,
    reactivate_employee,
    search_employee,
)

# Log in as HR
alice_details = login_user(
    "alice_hr_test",
    "DevHRPassword!482"
)
alice_session = create_session(alice_details)

# Log in as Employee
david_details = login_user(
    "david_test",
    "DemoPassword!482"
)
david_session = create_session(david_details)


print("\nTEST 1: HR reactivates David")
result1 = reactivate_employee(
    session=alice_session,
    employee_id=4
)
print("Passed:", result1 is True)


print("\nTEST 2: Employee cannot reactivate an employee")
result2 = reactivate_employee(
    session=david_session,
    employee_id=4
)
print("Passed:", result2 is False)


print("\nTEST 3: HR cannot reactivate an already active employee")
result3 = reactivate_employee(
    session=alice_session,
    employee_id=4
)
print("Passed:", result3 is False)


print("\nTEST 4: Verify David is active")
employee = search_employee(4)

print(
    "Passed:",
    employee is not None
    and employee["employment_status"] == "Active"
)
