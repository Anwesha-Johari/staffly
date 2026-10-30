
from employee_backend import (
    login_user,
    create_session,
    generate_payroll,
    view_payroll
)

# Authenticate Alice as HR
alice_details = login_user(
    "alice_hr_test",
    "DevHRPassword!482"
)
alice_session = create_session(alice_details)

# Authenticate David as Employee
david_details = login_user(
    "david_test",
    "DemoPassword!482"
)
david_session = create_session(david_details)


print("\nTEST 1: HR generates December payroll")

result1 = generate_payroll(
    session=alice_session,
    employee_id=4,
    pay_month="2026-12-01",
    basic_salary="45000.00",
    allowances="3000.00",
    deductions="1000.00"
)
print("Passed:", result1 is not False and result1 is not None)


print("\nTEST 2: Employee attempts to generate payroll")

result2 = generate_payroll(
    session=david_session,
    employee_id=4,
    pay_month="2027-01-01",
    basic_salary="45000.00",
    allowances="3000.00",
    deductions="1000.00"
)
print("Passed:", result2 is False)


print("\nTEST 3: Verify December payroll")

records = view_payroll(
    employee_id=4,
    pay_month="2026-12-01"
)

print(
    "Passed:",
    isinstance(records, list)
    and len(records) == 1
    and records[0]["net_salary"] == 47000
)
