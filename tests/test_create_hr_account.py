
from employee_backend import create_user_account

result = create_user_account(
    employee_id=1,
    username="alice_hr_test",
    password="DevHRPassword!482",
    access_role="HR"
)

print("HR account creation result:", result)
