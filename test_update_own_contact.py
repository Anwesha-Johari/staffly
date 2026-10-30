
from employee_backend import (
    login_user,
    create_session,
    update_own_contact,
    get_connection
)

ORIGINAL_PHONE = "9876543210"
TEST_PHONE = "9876543211"

details = login_user("david_test", "DemoPassword!482")

if not details:
    print("Login failed. Test stopped.")
    raise SystemExit(1)

session = create_session(details)

if not session:
    print("Session creation failed. Test stopped.")
    raise SystemExit(1)


def get_david_phone():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(
            "SELECT phone FROM employees WHERE employee_id = %s",
            (session.employee_id,)
        )
        result = cursor.fetchone()
        return result[0] if result else None

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


print("\nTEST 1: Temporarily update David's phone number")

try:
    result = update_own_contact(
        session=session,
        phone=TEST_PHONE
    )
    actual_phone = get_david_phone()

    passed = result is True and actual_phone == TEST_PHONE
    print("Passed:", passed)

finally:
    # Restore the original number even if the test fails.
    restored = update_own_contact(
        session=session,
        phone=ORIGINAL_PHONE
    )

    print("\nTEST 2: Restore David's original phone number")
    actual_phone = get_david_phone()

    passed_restore = (
        restored is True
        and actual_phone == ORIGINAL_PHONE
    )
    print("Passed:", passed_restore)

    if not passed_restore:
        print("WARNING: Phone restoration could not be verified.")
        print("Please check David's phone number in MySQL.")
