from employee_backend import (
    login_user,
    create_session,
    review_leave_request,
    view_leave_requests,
)

# Log in as Alice, an HR user
alice_details = login_user(
    "alice_hr_test",
    "DevHRPassword!482"
)

if not alice_details:
    print("HR login failed. Stopping test.")
    raise SystemExit(1)

alice_session = create_session(alice_details)

if not alice_session:
    print("Could not create HR session. Stopping test.")
    raise SystemExit(1)

# Approve David's pending leave request
print("\nTEST: HR approves David's leave request")

result = review_leave_request(
    session=alice_session,
    leave_id=4,
    decision="Approved"
)

print("Approval result:", result)

# Verify the saved database record
print("\nUpdated leave request:")
view_leave_requests(
    session=alice_session,
    employee_id=4
)