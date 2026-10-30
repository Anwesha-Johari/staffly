
from employee_backend import (
    login_user,
    create_session,
    update_payroll_status,
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


# David's December payroll should have ID 5
payroll_id = 5

print("\nTEST 1: HR marks payroll as Paid")
result1 = update_payroll_status(
    session=alice_session,
    payroll_id=payroll_id,
    new_status="Paid"
)
print("Passed:", result1 is True)


print("\nTEST 2: HR changes status to On Hold")
result2 = update_payroll_status(
    session=alice_session,
    payroll_id=payroll_id,
    new_status="On Hold"
)
print("Passed:", result2 is True)


print("\nTEST 3: Employee attempts to change payroll")
result3 = update_payroll_status(
    session=david_session,
    payroll_id=payroll_id,
    new_status="Paid"
)
print("Passed:", result3 is False)


print("\nTEST 4: Invalid payment status")
result4 = update_payroll_status(
    session=alice_session,
    payroll_id=payroll_id,
    new_status="Completed"
)
print("Passed:", result4 is False)


print("\nTEST 5: Nonexistent payroll ID")
result5 = update_payroll_status(
    session=alice_session,
    payroll_id=9999,
    new_status="Paid"
)
print("Passed:", result5 is False)
