
from employee_backend import (
    login_user,
    create_session,
    add_employee,
    view_employees
)


def main():
    print("Log in with your Admin account.")
    admin_details = login_user(
        "abc",
        input("Enter Admin password: ")
    )

    if not admin_details:
        print("Admin login failed. Test stopped.")
        return

    admin_session = create_session(admin_details)

    if not admin_session:
        print("Session creation failed. Test stopped.")
        return

    print("\n1. VIEW EXISTING EMPLOYEES")
    view_employees(admin_session)

    print("\n2. ADD A TEST EMPLOYEE")
    answer = input(
        "\nDo you want to add a test employee? (yes/no): "
    ).strip().lower()

    if answer == "yes":
        print(
            "For safety, this script will not insert David again "
            "because his email already exists."
        )
        print(
            "We can test adding a new employee separately "
            "with unique test data."
        )
    else:
        print("No new employee was added.")


if __name__ == "__main__":
    main()

    print("\n1B. TEST EMPLOYEE ACCESS RESTRICTIONS")

    employee_details = login_user(
        "david_test",
        "DemoPassword!482"
    )

    if employee_details:
        employee_session = create_session(employee_details)

        print("\nEmployee should see only their own record:")
        view_employees(employee_session)
    else:
        print("Employee login failed.")
