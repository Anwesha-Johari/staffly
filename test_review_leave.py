
from employee_backend import (
    login_user,
    create_session,
    review_leave_request,
    view_leave_requests,
)
import inspect
from employee_backend import review_leave_request

print("Function location:", inspect.getsourcefile(review_leave_request))
print("Function signature:", inspect.signature(review_leave_request))
print(inspect.getsource(review_leave_request))

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


print("\nTEST 1: Employee cannot review a leave request")

# David's leave request was previously rejected.
# Rejection should occur because of authorization, not request status.
result1 = review_leave_request(
    session=david_session,
    leave_id=3,
    decision="Approved"
)
print("Passed:", result1 is False)


print("\nTEST 2: HR rejects a nonexistent request")

result2 = review_leave_request(
    session=alice_session,
    leave_id=9999,
    decision="Rejected"
)
print("Passed:", result2 is False)


print("\nTEST 3: HR cannot use an invalid decision")

result3 = review_leave_request(
    session=alice_session,
    leave_id=3,
    decision="Pending"
)
print("Passed:", result3 is False)


print("\nTEST 4: Missing session is rejected")

result4 = review_leave_request(
    session=None,
    leave_id=3,
    decision="Approved"
)
print("Passed:", result4 is False)
