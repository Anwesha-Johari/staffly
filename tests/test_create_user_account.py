
from employee_backend import (
    login_user,
    create_session,
    create_user_account,
    get_connection,
    verify_password
)

# Log in using the existing accounts.
admin_details = login_user("abc", input("Enter Admin password: "))
hr_details = login_user("alice_hr_test", "DevHRPassword!482")
employee_details = login_user("david_test", "DemoPassword!482")

if not admin_details or not hr_details or not employee_details:
    print("Login failed. Tests stopped.")
    raise SystemExit(1)

admin_session = create_session(admin_details)
hr_session = create_session(hr_details)
employee_session = create_session(employee_details)

if not admin_session or not hr_session or not employee_session:
    print("Session creation failed. Tests stopped.")
    raise SystemExit(1)


print("\nTEST 1: Missing session is rejected")
result1 = create_user_account(
    session=None,
    employee_id=3,
    username="carol_test",
    password="ExamplePassword!123",
    access_role="Employee"
)
print("Passed:", result1 is False)


print("\nTEST 2: Employee cannot create an account")
result2 = create_user_account(
    session=employee_session,
    employee_id=3,
    username="carol_test",
    password="ExamplePassword!123",
    access_role="Employee"
)
print("Passed:", result2 is False)


print("\nTEST 3: HR cannot create an Admin account")
result3 = create_user_account(
    session=hr_session,
    employee_id=3,
    username="carol_admin_test",
    password="ExamplePassword!123",
    access_role="Admin"
)
print("Passed:", result3 is False)


print("\nTEST 4: HR cannot create an HR account")
result4 = create_user_account(
    session=hr_session,
    employee_id=3,
    username="carol_hr_test",
    password="ExamplePassword!123",
    access_role="HR"
)
print("Passed:", result4 is False)


print("\nTEST 5: Invalid employee ID is rejected")
result5 = create_user_account(
    session=admin_session,
    employee_id=9999,
    username="missing_employee",
    password="ExamplePassword!123",
    access_role="Employee"
)
print("Passed:", result5 is False)


print("\nTEST 6: Weak password is rejected")
result6 = create_user_account(
    session=admin_session,
    employee_id=3,
    username="carol_test",
    password="short",
    access_role="Employee"
)
print("Passed:", result6 is False)


print("\nTEST 7: Existing account password remains hashed")
connection = None
cursor = None

try:
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT username, password_hash, access_role, account_status
        FROM user_accounts
        WHERE username = %s
        """,
        ("david_test",)
    )

    account = cursor.fetchone()

    passed7 = (
        account is not None
        and account["password_hash"] != "DemoPassword!482"
        and verify_password(
            "DemoPassword!482",
            account["password_hash"]
        )
        and account["access_role"] == "Employee"
        and account["account_status"] == "Active"
    )

    print("Passed:", bool(passed7))

finally:
    if cursor:
        cursor.close()
    if connection and connection.is_connected():
        connection.close()


print("\nTEST 8: Admin cannot create an account without a valid role")
result8 = create_user_account(
    session=admin_session,
    employee_id=3,
    username="carol_test",
    password="ExamplePassword!123",
    access_role="SuperAdmin"
)
print("Passed:", result8 is False)
