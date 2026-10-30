import streamlit as st
import pandas as pd
from datetime import date, time, datetime
from decimal import Decimal
import employee_backend as backend


# ============================================================
# GLOBAL STYLING
# ============================================================
def inject_global_css():
    st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    .stApp {
        background:
            radial-gradient(circle at 10% 0%, rgba(99,102,241,0.16), transparent 40%),
            radial-gradient(circle at 90% 10%, rgba(236,72,153,0.14), transparent 45%),
            radial-gradient(circle at 50% 100%, rgba(34,211,238,0.12), transparent 50%),
            linear-gradient(160deg, #f8fafc 0%, #eef2ff 45%, #fdf2f8 100%);
        background-attachment: fixed;
        font-family: 'Inter', sans-serif;
        color: #1e1b4b;
    }
    #MainMenu, footer, header { visibility: hidden; }
    .block-container { padding-top: 1.5rem; padding-bottom: 3rem; max-width: 1200px; }

    .staffly-hero {
        position: relative; overflow: hidden; border-radius: 26px;
        padding: 56px 48px; margin-bottom: 28px;
        background:
            linear-gradient(120deg, rgba(30,41,59,0.92), rgba(67,56,202,0.88)),
            url("https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80");
        background-size: cover; background-position: center;
        box-shadow: 0 24px 60px -20px rgba(49,46,129,0.6); color: #fff;
    }
    .staffly-hero::after {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(circle at 85% 20%, rgba(236,72,153,0.35), transparent 55%);
        pointer-events: none;
    }
    .staffly-hero-content { position: relative; z-index: 2; max-width: 640px; }
    .staffly-label {
        display: inline-block; font-size: 0.72rem; font-weight: 700;
        letter-spacing: 0.16em; text-transform: uppercase;
        padding: 7px 16px; border-radius: 999px;
        background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.28);
        backdrop-filter: blur(6px); margin-bottom: 20px;
    }
    .staffly-hero h1 {
        font-size: 2.9rem; font-weight: 800; line-height: 1.1;
        margin: 0 0 14px 0; letter-spacing: -0.03em; color: #fff;
    }
    .staffly-hero p {
        font-size: 1.05rem; line-height: 1.65;
        color: rgba(255,255,255,0.85); margin: 0;
    }
    h2, h3 {
        font-family: 'Inter', sans-serif !important;
        color: #1e1b4b !important;
        letter-spacing: -0.02em; font-weight: 700 !important;
    }
    div[data-testid="stMetric"] {
        background: rgba(255,255,255,0.82); backdrop-filter: blur(14px);
        border: 1px solid rgba(255,255,255,0.9); border-radius: 20px;
        padding: 22px 24px;
        box-shadow: 0 14px 34px -16px rgba(79,70,229,0.35);
        transition: transform .25s ease, box-shadow .25s ease;
    }
    div[data-testid="stMetric"]:hover {
        transform: translateY(-4px);
        box-shadow: 0 22px 46px -18px rgba(79,70,229,0.5);
    }
    div[data-testid="stMetricLabel"] p {
        font-size: .78rem !important; font-weight: 600 !important;
        letter-spacing: .08em; text-transform: uppercase;
        color: #6366f1 !important;
    }
    div[data-testid="stMetricValue"] {
        font-size: 2rem !important; font-weight: 800 !important;
        color: #1e1b4b !important;
    }
    .stButton > button {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%);
        color: #fff !important; border: none; border-radius: 14px;
        padding: 12px 26px; font-weight: 600; font-size: .95rem;
        box-shadow: 0 12px 26px -10px rgba(139,92,246,0.7);
        transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
    }
    .stButton > button:hover {
        transform: translateY(-2px); filter: brightness(1.08);
        box-shadow: 0 18px 34px -12px rgba(139,92,246,0.85);
    }
    .stButton > button p, .stButton > button span, .stButton > button div {
        color: #fff !important;
    }
    .stFormSubmitButton > button {
        background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
        color: #fff !important; border: none; border-radius: 14px;
        padding: 12px 28px; font-weight: 600;
        box-shadow: 0 12px 26px -10px rgba(14,165,233,0.7);
    }
    .stFormSubmitButton > button p,
    .stFormSubmitButton > button span,
    .stFormSubmitButton > button div {
        color: #fff !important;
    }
    .stTextInput input,
    .stNumberInput input,
    .stDateInput input,
    .stTimeInput input,
    .stTextArea textarea,
    div[data-baseweb="input"] input,
    div[data-baseweb="base-input"] input {
        background-color: #ffffff !important;
        color: #1e1b4b !important;
        -webkit-text-fill-color: #1e1b4b !important;
        caret-color: #6366f1 !important;
        border-radius: 12px !important;
        border: 1.5px solid #e0e7ff !important;
        font-weight: 500 !important;
    }
    .stTextArea textarea {
        background-color: #ffffff !important;
        color: #1e1b4b !important;
        -webkit-text-fill-color: #1e1b4b !important;
    }
    .stTextInput div[data-baseweb="input"],
    .stNumberInput div[data-baseweb="input"],
    .stTextArea div[data-baseweb="textarea"],
    div[data-baseweb="base-input"] {
        background-color: #ffffff !important;
        border-radius: 12px !important;
        border: 1.5px solid #e0e7ff !important;
    }
    .stTextInput input:focus,
    .stNumberInput input:focus,
    .stDateInput input:focus,
    .stTimeInput input:focus,
    .stTextArea textarea:focus,
    div[data-baseweb="input"]:focus-within {
        border-color: #6366f1 !important;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.18) !important;
        outline: none !important;
    }
    .stTextInput input::placeholder,
    .stNumberInput input::placeholder,
    .stTextArea textarea::placeholder,
    .stDateInput input::placeholder,
    .stTimeInput input::placeholder {
        color: #94a3b8 !important;
        -webkit-text-fill-color: #94a3b8 !important;
        opacity: 1 !important;
    }
    div[data-baseweb="select"] > div {
        background-color: #ffffff !important;
        color: #1e1b4b !important;
        border-radius: 12px !important;
        border: 1.5px solid #e0e7ff !important;
    }
    div[data-baseweb="select"] > div * {
        color: #1e1b4b !important;
    }
    div[data-baseweb="popover"] ul,
    div[data-baseweb="popover"] li {
        background-color: #ffffff !important;
        color: #1e1b4b !important;
    }
    div[data-baseweb="popover"] li:hover {
        background-color: #eef2ff !important;
    }
    div[data-baseweb="menu"] {
        background-color: #ffffff !important;
        border-radius: 12px !important;
    }
    div[data-baseweb="select"] span[data-baseweb="tag"] {
        background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
        color: #fff !important;
    }
    div[data-baseweb="select"] span[data-baseweb="tag"] span {
        color: #fff !important;
    }
    .stRadio label, .stCheckbox label,
    .stRadio div, .stCheckbox div {
        color: #1e1b4b !important;
    }
    label, .stSelectbox label, .stTextInput label,
    .stNumberInput label, .stDateInput label,
    .stTimeInput label, .stTextArea label {
        font-weight: 600 !important;
        color: #3730a3 !important;
        font-size: .86rem !important;
    }
    .stCaption, small, [data-testid="stCaptionContainer"] {
        color: #64748b !important;
    }
    div[data-testid="stDataFrame"] {
        border-radius: 18px; overflow: hidden;
        border: 1px solid rgba(224,231,255,0.9);
        box-shadow: 0 14px 34px -18px rgba(79,70,229,0.35);
        background: #fff;
    }
    div[data-testid="stForm"] {
        background: rgba(255,255,255,0.75); backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.9); border-radius: 22px;
        padding: 28px;
        box-shadow: 0 18px 44px -22px rgba(79,70,229,0.4);
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px; background: rgba(255,255,255,0.6);
        padding: 8px; border-radius: 16px;
        border: 1px solid rgba(224,231,255,0.9);
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 10px; font-weight: 600;
        color: #4338ca !important; padding: 8px 18px;
    }
    .stTabs [data-baseweb="tab"] p {
        color: #4338ca !important;
    }
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    .stTabs [aria-selected="true"] p,
    .stTabs [aria-selected="true"] {
        color: #fff !important;
    }
    div[data-testid="stAlert"] { border-radius: 14px; border: none; }
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%);
    }
    section[data-testid="stSidebar"] * { color: #e0e7ff !important; }
    section[data-testid="stSidebar"] label,
    section[data-testid="stSidebar"] .stRadio label,
    section[data-testid="stSidebar"] .stRadio div {
        color: #e0e7ff !important;
    }
    section[data-testid="stSidebar"] .stButton > button {
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.25);
        box-shadow: none;
        color: #fff !important;
    }
    section[data-testid="stSidebar"] .stButton > button:hover {
        background: rgba(255,255,255,0.22);
    }
    hr { border-color: rgba(99,102,241,0.15) !important; }
    </style>
    """, unsafe_allow_html=True)


def show_staffly_banner():
    st.markdown("""
    <div class="staffly-hero">
        <div class="staffly-hero-content">
            <div class="staffly-label">✦ YOUR PEOPLE MANAGEMENT HUB</div>
            <h1>Welcome to Staffly</h1>
            <p>People, work, and progress — all in one place. Manage your team
               effortlessly with a clean, modern workspace built for clarity and speed.</p>
        </div>
    </div>
    """, unsafe_allow_html=True)


def show_feature_strip():
    st.markdown("""
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:8px 0 28px 0;">
        <div style="border-radius:20px;overflow:hidden;position:relative;height:140px;box-shadow:0 16px 36px -18px rgba(79,70,229,.45);">
            <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(30,27,75,.85));display:flex;align-items:flex-end;padding:16px;">
                <span style="color:#fff;font-weight:700;font-size:1rem;">Team Overview</span></div>
        </div>
        <div style="border-radius:20px;overflow:hidden;position:relative;height:140px;box-shadow:0 16px 36px -18px rgba(79,70,229,.45);">
            <img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(30,27,75,.85));display:flex;align-items:flex-end;padding:16px;">
                <span style="color:#fff;font-weight:700;font-size:1rem;">Collaboration</span></div>
        </div>
        <div style="border-radius:20px;overflow:hidden;position:relative;height:140px;box-shadow:0 16px 36px -18px rgba(79,70,229,.45);">
            <img src="https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=800&q=80" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(30,27,75,.85));display:flex;align-items:flex-end;padding:16px;">
                <span style="color:#fff;font-weight:700;font-size:1rem;">Growth &amp; Progress</span></div>
        </div>
    </div>
    """, unsafe_allow_html=True)


EMPLOYEE_COLUMNS = [
    "employee_id", "first_name", "last_name", "email", "phone",
    "hire_date", "salary", "department_name", "role_title",
    "manager_name", "employment_status",
]


def employees_to_df(records):
    if not records:
        return pd.DataFrame(columns=EMPLOYEE_COLUMNS)
    if isinstance(records, list) and records and isinstance(records[0], dict):
        return pd.DataFrame(records)
    return pd.DataFrame(records, columns=EMPLOYEE_COLUMNS)


def login_screen():
    st.markdown("""
    <div style="max-width:460px;margin:6vh auto 0 auto;padding:44px 40px;
                background:rgba(255,255,255,0.85);backdrop-filter:blur(16px);
                border:1px solid rgba(255,255,255,0.95);border-radius:26px;
                box-shadow:0 30px 70px -30px rgba(49,46,129,0.55);">
        <div style="font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
                    font-weight:700;color:#6366f1;margin-bottom:10px;">✦ STAFFLY</div>
        <h2 style="margin:0 0 6px 0;font-size:1.9rem;color:#1e1b4b;">Sign in</h2>
        <p style="color:#64748b;margin:0 0 24px 0;font-size:.95rem;">
            Access your employee management workspace.
        </p>
    </div>
    """, unsafe_allow_html=True)

    with st.form("login_form"):
        username = st.text_input("Username", placeholder="your.username")
        password = st.text_input("Password", type="password", placeholder="••••••••")
        submitted = st.form_submit_button("Sign in", use_container_width=True)

        if submitted:
            if not username or not password:
                st.error("Please enter both username and password.")
                return
            with st.spinner("Authenticating…"):
                account = backend.login_user(username, password)
            if not account:
                st.error("Invalid username or password.")
                return
            session = backend.create_session(account)
            if not session:
                st.error("Could not create session.")
                return
            st.session_state.session = session
            st.rerun()


def render_sidebar():
    session = st.session_state.session
    with st.sidebar:
        st.markdown(f"""
        <div style="padding:8px 0 20px 0;">
            <div style="font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
                        font-weight:700;color:#a5b4fc;">✦ STAFFLY</div>
            <div style="font-size:1.35rem;font-weight:800;color:#fff;margin-top:4px;">
                {session.employee_name}
            </div>
            <div style="display:inline-block;margin-top:8px;padding:4px 12px;
                        border-radius:999px;background:rgba(255,255,255,0.15);
                        border:1px solid rgba(255,255,255,0.3);
                        font-size:.75rem;font-weight:600;color:#e0e7ff;">
                {session.access_role}
            </div>
        </div>
        """, unsafe_allow_html=True)
        st.divider()

        nav = st.radio(
            "Navigation",
            ["Dashboard", "Employees", "Attendance", "Leave", "Payroll", "Accounts"],
            label_visibility="collapsed",
        )

        st.divider()
        if st.button("Sign out", use_container_width=True):
            st.session_state.clear()
            st.rerun()
        return nav


def page_dashboard():
    session = st.session_state.session
    show_staffly_banner()
    show_feature_strip()

    employees = backend.view_employees(session) or []
    df = employees_to_df(employees)

    total = len(df)
    active = (df["employment_status"] == "Active").sum() if not df.empty else 0
    on_leave = (df["employment_status"] == "On Leave").sum() if not df.empty else 0
    depts = df["department_name"].nunique() if not df.empty else 0

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Employees", total)
    c2.metric("Active", int(active))
    c3.metric("On Leave", int(on_leave))
    c4.metric("Departments", int(depts))

    st.markdown("<hr>", unsafe_allow_html=True)
    st.subheader("Recent Team Members")
    if not df.empty:
        preview = df[["employee_id", "first_name", "last_name", "email",
                      "department_name", "role_title", "employment_status"]].tail(5)
        st.dataframe(preview, use_container_width=True, hide_index=True)
    else:
        st.info("No employees found.")



# ============================================================
# EMPLOYEES
# ============================================================
def page_employees():
    session = st.session_state.session
    st.markdown("## Employee Directory")

    tab1, tab2, tab3, tab4 = st.tabs(
        ["  View All  ", "  Add Employee  ", "  Search  ", "  Update / Status  "]
    )

    with tab1:
        employees = backend.view_employees(session) or []
        df = employees_to_df(employees)
        if df.empty:
            st.info("No employees found.")
        else:
            st.dataframe(df, use_container_width=True, hide_index=True)

    with tab2:
        if session.access_role not in ("Admin", "HR"):
            st.warning("Only Admin and HR can add employees.")
            return

        departments = backend.get_departments()
        roles = backend.get_job_roles()
        managers = backend.get_active_employees_for_dropdown()

        with st.form("add_employee"):
            c1, c2 = st.columns(2)
            with c1:
                first_name = st.text_input("First Name")
                last_name = st.text_input("Last Name")
                email = st.text_input("Email")
                phone = st.text_input("Phone")
                hire_date = st.date_input("Hire Date", value=date.today())
                salary = st.number_input("Salary", min_value=0.0, step=100.0)
            with c2:
                dept_name = st.selectbox(
                    "Department",
                    [d["department_name"] for d in departments] or ["—"]
                )
                role_title = st.selectbox(
                    "Job Role",
                    [r["role_title"] for r in roles] or ["—"]
                )
                manager_options = [("—", None)] + [
                    (m["employee_name"], m["employee_id"]) for m in managers
                ]
                manager_label = st.selectbox(
                    "Manager",
                    [m[0] for m in manager_options]
                )
                manager_id = dict(manager_options)[manager_label]

            submitted = st.form_submit_button("Add Employee")
            if submitted:
                dept_id = next(
                    (d["department_id"] for d in departments
                     if d["department_name"] == dept_name), None
                )
                role_id = next(
                    (r["role_id"] for r in roles
                     if r["role_title"] == role_title), None
                )
                if dept_id is None or role_id is None:
                    st.error("Please ensure departments and job roles exist.")
                else:
                    new_id = backend.add_employee(
                        session, first_name, last_name, email, phone,
                        hire_date, Decimal(str(salary)),
                        dept_id, role_id, manager_id
                    )
                    if new_id:
                        st.success(f"✓ Employee added with ID {new_id}.")
                        st.rerun()
                    else:
                        st.error("Could not add employee. Check the terminal for details.")

    with tab3:
        query = st.text_input("Search by ID, email, or name")
        if st.button("Search"):
            if not query.strip():
                st.warning("Enter a search value.")
            else:
                result = backend.search_employee(session, query)
                if not result:
                    st.info("No matching employee found.")
                else:
                    rows = result if isinstance(result, list) else [result]
                    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    with tab4:
        if session.access_role not in ("Admin", "HR"):
            st.warning("Only Admin and HR can update employees.")
            return

        employees = backend.view_employees(session) or []
        df = employees_to_df(employees)
        if df.empty:
            st.info("No employees to update.")
            return

        options = [
            f"{r.employee_id} — {r.first_name} {r.last_name}"
            for r in df.itertuples()
        ]
        chosen = st.selectbox("Select employee", options)
        emp_id = int(chosen.split(" — ")[0])

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Update details**")
            new_email = st.text_input("New email (leave blank to keep)")
            new_phone = st.text_input("New phone (leave blank to keep)")
            if st.button("Update contact details"):
                kwargs = {}
                if new_email.strip():
                    kwargs["email"] = new_email
                if new_phone.strip():
                    kwargs["phone"] = new_phone
                if not kwargs:
                    st.warning("No changes entered.")
                else:
                    ok = backend.update_employee(session, emp_id, **kwargs)
                    st.success("Updated.") if ok else st.error("Update failed.")

        with col2:
            st.markdown("**Change employment status**")
            action = st.radio("Action", ["Deactivate", "Reactivate"], horizontal=True)
            if st.button("Apply status change"):
                if action == "Deactivate":
                    ok = backend.deactivate_employee(session, emp_id)
                else:
                    ok = backend.reactivate_employee(session, emp_id)
                st.success("Done.") if ok else st.error("Action failed.")


# ============================================================
# ATTENDANCE
# ============================================================
def page_attendance():
    session = st.session_state.session
    st.markdown("## Attendance")

    tab1, tab2 = st.tabs(["  Mark Attendance  ", "  View Records  "])

    with tab1:
        with st.form("mark_attendance"):
            emp_id = st.number_input(
                "Employee ID", min_value=1, step=1,
                value=session.employee_id
            )
            att_date = st.date_input("Date", value=date.today())
            status = st.selectbox("Status", ["Present", "Absent", "Half Day", "Holiday"])
            check_in = st.time_input("Check-in", value=time(9, 0))
            check_out = st.time_input("Check-out", value=time(17, 0))
            if st.form_submit_button("Record Attendance"):
                ok = backend.mark_attendance(
                    session, int(emp_id), att_date, status,
                    check_in=check_in, check_out=check_out
                )
                st.success("Attendance recorded.") if ok else st.error("Failed to record attendance.")

    with tab2:
        emp_filter = st.number_input(
            "Filter by Employee ID (0 = all)", min_value=0, step=1,
            value=0 if session.access_role != "Employee" else session.employee_id
        )
        use_date = st.checkbox("Filter by date")
        att_date = st.date_input("Date", value=date.today()) if use_date else None

        if st.button("Load attendance"):
            records = backend.view_attendance(
                session,
                employee_id=emp_filter or None,
                attendance_date=att_date,
            )
            if not records:
                st.info("No attendance records found.")
            else:
                st.dataframe(pd.DataFrame(records), use_container_width=True, hide_index=True)

    st.markdown("---")
    st.markdown("### Monthly Summary")
    c1, c2, c3 = st.columns(3)
    with c1:
        sum_emp = st.number_input(
            "Employee ID", min_value=1, step=1,
            value=session.employee_id, key="sum_emp"
        )
    with c2:
        sum_year = st.number_input("Year", min_value=2000, max_value=2100,
                                   value=date.today().year, key="sum_year")
    with c3:
        sum_month = st.number_input("Month", min_value=1, max_value=12,
                                    value=date.today().month, key="sum_month")
    if st.button("Show summary"):
        summary = backend.monthly_attendance_summary(
            session, int(sum_emp), int(sum_year), int(sum_month)
        )
        if summary:
            st.dataframe(pd.DataFrame([summary]), use_container_width=True, hide_index=True)
        else:
            st.info("No summary available.")


# ============================================================
# LEAVE
# ============================================================
def page_leave():
    session = st.session_state.session
    st.markdown("## Leave Management")

    tab1, tab2, tab3 = st.tabs(["  Apply  ", "  My / All Requests  ", "  Review (Admin/HR)  "])

    with tab1:
        with st.form("apply_leave"):
            leave_type = st.selectbox("Leave Type", ["Annual", "Sick", "Maternity", "Unpaid", "Other"])
            start = st.date_input("Start date")
            end = st.date_input("End date")
            reason = st.text_area("Reason")
            if st.form_submit_button("Submit Leave Request"):
                ok = backend.apply_for_leave(session, leave_type, start, end, reason)
                st.success("Leave request submitted.") if ok else st.error("Submission failed.")

    with tab2:
        if session.access_role == "Employee":
            records = backend.view_leave_requests(session)
            if records:
                st.dataframe(pd.DataFrame(records), use_container_width=True, hide_index=True)
            else:
                st.info("No leave requests found.")
        else:
            col1, col2 = st.columns(2)
            with col1:
                emp_filter = st.number_input("Employee ID (0 = all)", min_value=0, step=1, value=0)
            with col2:
                status_filter = st.selectbox("Status", ["All", "Pending", "Approved", "Rejected"])
            if st.button("Load leave requests"):
                records = backend.view_leave_requests(
                    session,
                    employee_id=emp_filter or None,
                    leave_status=None if status_filter == "All" else status_filter,
                )
                if not records:
                    st.info("No requests found.")
                else:
                    st.dataframe(pd.DataFrame(records), use_container_width=True, hide_index=True)

    with tab3:
        if session.access_role not in ("Admin", "HR"):
            st.info("Only Admin and HR can review leave requests.")
            return
        pending = backend.view_leave_requests(session, leave_status="Pending") or []
        if not pending:
            st.success("No pending requests.")
            return
        st.dataframe(pd.DataFrame(pending), use_container_width=True, hide_index=True)
        options = [f"{r['leave_id']} — {r['employee_name']} ({r['leave_type']})" for r in pending]
        chosen = st.selectbox("Choose request", options)
        leave_id = int(chosen.split(" — ")[0])
        col1, col2 = st.columns(2)
        with col1:
            if st.button("✓ Approve"):
                ok = backend.review_leave_request(session, leave_id, "Approved")
                st.success("Approved.") if ok else st.error("Failed.")
                st.rerun()
        with col2:
            if st.button("✗ Reject"):
                ok = backend.review_leave_request(session, leave_id, "Rejected")
                st.success("Rejected.") if ok else st.error("Failed.")
                st.rerun()


# ============================================================
# PAYROLL
# ============================================================
def page_payroll():
    session = st.session_state.session
    st.markdown("## Payroll")

    tab1, tab2, tab3 = st.tabs(["  View  ", "  Generate (Admin/HR)  ", "  Status (Admin/HR)  "])

    with tab1:
        col1, col2 = st.columns(2)
        with col1:
            emp_filter = st.number_input("Employee ID (0 = all)", min_value=0, step=1, value=0)
        with col2:
            use_month = st.checkbox("Filter by month")
            month_val = st.date_input("Pay month", value=date.today().replace(day=1)) if use_month else None

        if st.button("Load payroll"):
            records = backend.view_payroll(
                session,
                employee_id=emp_filter or None,
                pay_month=month_val.replace(day=1) if month_val else None,
            )
            if not records:
                st.info("No payroll records found.")
            else:
                st.dataframe(pd.DataFrame(records), use_container_width=True, hide_index=True)

    with tab2:
        if session.access_role not in ("Admin", "HR"):
            st.warning("Only Admin and HR can generate payroll.")
            return
        with st.form("generate_payroll"):
            emp_id = st.number_input("Employee ID", min_value=1, step=1)
            pay_month = st.date_input("Pay month (use first of month)",
                                      value=date.today().replace(day=1))
            basic = st.number_input("Basic salary", min_value=0.0, step=100.0)
            allow = st.number_input("Allowances", min_value=0.0, step=50.0)
            deduct = st.number_input("Deductions", min_value=0.0, step=50.0)
            if st.form_submit_button("Generate payroll"):
                pid = backend.generate_payroll(
                    session, int(emp_id), pay_month,
                    Decimal(str(basic)), Decimal(str(allow)), Decimal(str(deduct))
                )
                st.success(f"Payroll ID {pid} generated.") if pid else st.error("Generation failed.")

    with tab3:
        if session.access_role not in ("Admin", "HR"):
            st.warning("Admin/HR only.")
            return
        with st.form("update_payroll_status"):
            payroll_id = st.number_input("Payroll ID", min_value=1, step=1)
            new_status = st.selectbox("New status", ["Pending", "Paid", "On Hold"])
            if st.form_submit_button("Update status"):
                ok = backend.update_payroll_status(session, int(payroll_id), new_status)
                st.success("Status updated.") if ok else st.error("Update failed.")


# ============================================================
# ACCOUNTS
# ============================================================
def page_accounts():
    session = st.session_state.session
    st.markdown("## User Accounts")

    if session.access_role not in ("Admin", "HR"):
        st.warning("Admin/HR only.")
        return

    tab1, tab2, tab3 = st.tabs(["  View  ", "  Create  ", "  Manage  "])

    with tab1:
        accounts = backend.view_user_accounts(session) or []
        if not accounts:
            st.info("No accounts found.")
        else:
            st.dataframe(pd.DataFrame(accounts), use_container_width=True, hide_index=True)

    with tab2:
        with st.form("create_account"):
            emp_id = st.number_input("Employee ID", min_value=1, step=1)
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            role = st.selectbox("Role", ["Employee", "HR", "Admin"])
            if st.form_submit_button("Create Account"):
                ok = backend.create_user_account(
                    session, int(emp_id), username, password, role
                )
                st.success("Account created.") if ok else st.error("Creation failed.")

    with tab3:
        accounts = backend.view_user_accounts(session) or []
        if not accounts:
            st.info("No accounts to manage.")
            return
        options = [f"{a['account_id']} — {a['username']} ({a['access_role']})" for a in accounts]
        chosen = st.selectbox("Account", options)
        acc_id = int(chosen.split(" — ")[0])

        col1, col2 = st.columns(2)
        with col1:
            st.markdown("**Change status**")
            new_status = st.radio("Status", ["Active", "Inactive"], horizontal=True)
            if st.button("Apply status"):
                try:
                    ok = backend.update_user_account_status(session, acc_id, new_status)
                    st.success("Updated.") if ok else st.error("Failed.")
                except ValueError as e:
                    st.error(str(e))
        with col2:
            st.markdown("**Change role**")
            new_role = st.selectbox("Role", ["Employee", "HR", "Admin"])
            if st.button("Apply role"):
                try:
                    ok = backend.update_user_account_role(session, acc_id, new_role)
                    st.success("Updated.") if ok else st.error("Failed.")
                except ValueError as e:
                    st.error(str(e))


# ============================================================
# MAIN
# ============================================================
def main():
    st.set_page_config(
        page_title="Staffly — Employee Management",
        page_icon="✦",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    inject_global_css()

    if "session" not in st.session_state or st.session_state.session is None:
        login_screen()
        return

    nav = render_sidebar()
    if nav == "Dashboard":
        page_dashboard()
    elif nav == "Employees":
        page_employees()
    elif nav == "Attendance":
        page_attendance()
    elif nav == "Leave":
        page_leave()
    elif nav == "Payroll":
        page_payroll()
    elif nav == "Accounts":
        page_accounts()


if __name__ == "__main__":
    main()