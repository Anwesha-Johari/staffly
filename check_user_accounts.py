
from employee_backend import get_connection

connection = None
cursor = None

try:
    connection = get_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            ua.account_id,
            ua.employee_id,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
            ua.username,
            ua.access_role,
            ua.account_status
        FROM user_accounts ua
        JOIN employees e
            ON ua.employee_id = e.employee_id
        ORDER BY ua.employee_id
        """
    )

    accounts = cursor.fetchall()

    if not accounts:
        print("No user accounts found.")
    else:
        for account in accounts:
            print(account)

finally:
    if cursor:
        cursor.close()
    if connection and connection.is_connected():
        connection.close()
