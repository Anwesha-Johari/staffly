
import getpass
import mysql.connector
from mysql.connector import Error

connection = None
cursor = None

try:
    # Enter your MySQL credentials when prompted.
    password = getpass.getpass("Enter your MySQL root password: ")

    connection = mysql.connector.connect(
        host="localhost",
        port=3306,
        user="root",
        password=password,
        database="employee_management"
    )

    print("Connected to MySQL successfully!")

    cursor = connection.cursor()

    cursor.execute("""
        SELECT employee_id, first_name, last_name, email
        FROM employees
        ORDER BY employee_id
    """)

    employees = cursor.fetchall()

    print("\nEmployees in the database:")
    for employee in employees:
        print(employee)

    print(f"\nTotal employees: {len(employees)}")

except Error as error:
    print("Database connection or query failed:")
    print(error)

finally:
    if cursor is not None:
        cursor.close()

    if connection is not None and connection.is_connected():
        connection.close()
        print("\nDatabase connection closed.")
