
from employee_backend import (
    login_user,
    create_session,
    create_user_account
)
from getpass import getpass
print("\n--- Account Role Validation Tests ---")

# Log in as Admin
admin_password = getpass("Enter your Admin password: ")
admin_details = login_user("abc", admin_password)
admin_session = create_session(admin_details)

# Invalid role inputs
invalid_roles = [
    None,
    123,
    "",
    "SuperAdmin",
    "Manager"
]

for role in invalid_roles:
    result = create_user_account(
        admin_session,
        4,
        "temporary_test",
        "TestPassword123!",
        role
    )

    if result is False:
        print(f"PASS: Invalid role {role!r} rejected.")
    else:
        print(f"FAIL: Invalid role {role!r} accepted.")

print("\n--- Tests Completed ---")
