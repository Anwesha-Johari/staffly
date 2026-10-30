from employee_backend import (
    login_user,
    create_session,
    apply_for_leave,
    view_leave_requests,
)

# Log in as David
david_details = login_user(
    "david_test",
    "DemoPassword!482"
)

if not david_details:
    print("Login failed. Test stopped.")
    raise SystemExit(1)

david_session = create_session(david_details)

if not david_session:
    print("Session creation failed. Test stopped.")
    raise SystemExit(1)

print("\nTEST: Submit a leave request using David's session")

result = apply_for_leave(
    session=david_session,
    leave_type="Casual",
    start_date="2026-12-15",
    end_date="2026-12-16",
    reason="Testing session-based leave application"
)

print("Application result:", result)

print("\nPending leave requests:")
view_leave_requests(
    session=david_session,
    leave_status="Pending"
)