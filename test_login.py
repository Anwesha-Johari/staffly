
from employee_backend import (
    login_user,
    get_connection
)

test_username = "david_test"
test_password = "DemoPassword!482"

print("\nTEST 1: Correct username and password")

result1 = login_user(test_username, test_password)

print("Passed:", result1 is not None)

if result1:
    print("Username:", result1["username"])
    print("Employee ID:", result1["employee_id"])
    print("Employee name:", result1["employee_name"])
    print("Role:", result1["access_role"])
    print("Password hash exposed:", "password_hash" in result1)


print("\nTEST 2: Incorrect password")

result2 = login_user(test_username, "WrongPassword!482")
print("Passed:", result2 is None)


print("\nTEST 3: Unknown username")

result3 = login_user("unknown_test_user", test_password)
print("Passed:", result3 is None)


print("\nTEST 4: Empty password")

result4 = login_user(test_username, "")
print("Passed:", result4 is None)


print("\nTEST 5: Disabled account")

connection = None
cursor = None

try:
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE user_accounts
        SET account_status = 'Disabled'
        WHERE username = %s
        """,
        (test_username,)
    )
    connection.commit()

finally:
    if cursor:
        cursor.close()
    if connection and connection.is_connected():
        connection.close()

result5 = login_user(test_username, test_password)
print("Passed:", result5 is None)


# Restore the development account so we can keep using it.
connection = None
cursor = None

try:
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE user_accounts
        SET account_status = 'Active'
        WHERE username = %s
        """,
        (test_username,)
    )
    connection.commit()

    print("\nDevelopment account restored to Active.")

finally:
    if cursor:
        cursor.close()
    if connection and connection.is_connected():
        connection.close()
