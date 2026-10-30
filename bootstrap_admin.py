
import getpass

from employee_backend import get_connection, hash_password


EMPLOYEE_ID = 2  # Bob Wilson


def bootstrap_admin():
    print("=== Initial Admin Account Setup ===")

    username = input("Choose an Admin username: ").strip()
    password = getpass.getpass("Choose an Admin password: ")
    confirm_password = getpass.getpass("Confirm Admin password: ")

    if password != confirm_password:
        print("Passwords do not match. Setup cancelled.")
        return

    if len(password) < 8:
        print("Password must contain at least 8 characters.")
        return

    if len(password.encode("utf-8")) > 72:
        print("Password must not exceed 72 UTF-8 bytes.")
        return

    password_hash = hash_password(password)

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=True)

        # This setup must run only when no Admin exists.
        cursor.execute(
            """
            SELECT account_id
            FROM user_accounts
            WHERE access_role = 'Admin'
            LIMIT 1
            """
        )

        if cursor.fetchone():
            print("An Admin account already exists. Setup cancelled.")
            return

        # Confirm Bob exists and does not already have an account.
        cursor.execute(
            """
            SELECT employee_id, first_name, last_name
            FROM employees
            WHERE employee_id = %s
              AND employment_status = 'Active'
            """,
            (EMPLOYEE_ID,)
        )
        employee = cursor.fetchone()

        if not employee:
            print("The selected active employee was not found.")
            return

        cursor.execute(
            """
            SELECT account_id
            FROM user_accounts
            WHERE employee_id = %s OR username = %s
            """,
            (EMPLOYEE_ID, username)
        )

        if cursor.fetchone():
            print("That employee or username already has an account.")
            return

        cursor.execute(
            """
            INSERT INTO user_accounts
                (employee_id, username, password_hash, access_role)
            VALUES (%s, %s, %s, 'Admin')
            """,
            (EMPLOYEE_ID, username, password_hash)
        )

        connection.commit()

        print(
            f"Admin account created for "
            f"{employee['first_name']} {employee['last_name']}."
        )
        print("Username:", username)

    except Exception as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("Admin setup failed:", error)

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    bootstrap_admin()
