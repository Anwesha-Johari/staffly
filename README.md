# Staffly

Staffly is an employee management system built on MySQL. It has a Python backend (`backend/employee_backend.py`) that implements the business operations (employees, attendance, leave, payroll, user accounts with role-based access), a Streamlit app on top of it, and a Next.js dashboard, "Staffly, under the hood", that uses the same database schema to teach how a relational DBMS works.

The dashboard parses `database/schemas.sql` at render time, so its tables, columns, keys, constraints and ER diagram always match the DDL. It can optionally connect to a live MySQL server. It follows one honesty rule: anything that comes from a live database (row counts, real `EXPLAIN` output, results of a transaction experiment) is labelled as live, and anything that is static or illustrative (the schema read from the file, hand-written query plans, scripted scenarios) is labelled as such. When no database is reachable the dashboard runs in a clearly marked static mode instead of faking live data.

## Repository map

| Path | What it is |
| --- | --- |
| `backend/employee_backend.py` | All database operations as Python functions (login, sessions, employees, attendance, leave, payroll, accounts). Reads connection settings from environment variables. |
| `backend/app.py` | Streamlit UI that calls `employee_backend`. |
| `backend/bootstrap_admin.py` | Interactive one-off script that creates the first Admin account (for employee_id 2) when no Admin exists. |
| `backend/check_user_accounts.py` | Prints every row of `user_accounts` joined to `employees`. |
| `backend/db_test.py` | Interactive connectivity check (prompts for the MySQL root password, lists employees). |
| `backend/streamlit_test.py` | Minimal Streamlit "is it working" page. |
| `backend/requirements.txt` | Python dependencies (unpinned). |
| `database/schemas.sql` | Source of truth for the schema: 7 tables in the `employee_management` database. Contains DDL only. |
| `database/demo_seed.sql` | Fake demo data and demo accounts for local development only. See [database/README.md](database/README.md). |
| `database/emsDB.sql` | Scratch queries (`SELECT *`, `SHOW TABLES`, `DESCRIBE`) for inspecting the database by hand. |
| `tests/` | 24 standalone Python scripts that exercise the backend functions (see "Tests"). |
| `frontend/` | Next.js dashboard. See [frontend/README.md](frontend/README.md). |

## Running it

### 1. MySQL

Needs a MySQL 8 server (the DDL uses the `utf8mb4_0900_ai_ci` collation and `CHECK` constraints).

```bash
mysql -u root -p < database/schemas.sql
```

This creates the `employee_management` database and its tables. It does not insert any rows. For a demo database with fake data and three demo accounts for the Python app (local development only, never a shared or production database), also run `mysql -u root -p employee_management < database/demo_seed.sql`; see [database/README.md](database/README.md).

### 2. Backend environment

`backend/employee_backend.py` calls `load_dotenv()` and then reads these variables in `get_connection()`:

| Variable | Default |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | none (must be set if your MySQL user has a password) |
| `DB_NAME` | `employee_management` |

Put them in `backend/.env` (git-ignored):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-mysql-password
DB_NAME=employee_management
```

Install the Python dependencies (a virtual environment is recommended):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Streamlit app

Run it from inside `backend/` so `app.py` can import `employee_backend`:

```bash
cd backend
streamlit run app.py
```

You need an Admin account to log in. With the tables created and at least the employee with `employee_id = 2` present, `python bootstrap_admin.py` (also from `backend/`) creates one interactively. `streamlit run streamlit_test.py` is a smoke test that only checks Streamlit itself.

### 4. Dashboard (Next.js)

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:3000 for the employee dashboard (needs MySQL, no sign-in for now) or http://localhost:3000/under-the-hood for the explainer, which works with no database at all (static mode). To turn on live mode, copy `frontend/.env.example` to `frontend/.env.local` and fill in the `DB_*` values; the file is read by Next.js and is git-ignored, while `.env.example` is committed. Details are in [frontend/README.md](frontend/README.md). 

### Tests

The files in `tests/` are plain scripts, not a pytest/unittest suite: they have no assertions framework, print `Passed: True/False` lines, and need a real MySQL database. Run one at a time with `backend/` on the import path:

```bash
PYTHONPATH=backend python tests/test_login.py
```

Things to know before running them:

- They connect to whatever database `backend/.env` points at and call backend functions that write data (apply for leave, generate payroll, create accounts, change statuses). Use a throwaway database.
- They assume accounts that already exist in that database: an Admin named `abc` (several scripts ask for its password with `input()`/`getpass`), an HR account `alice_hr_test` (created by `tests/test_create_hr_account.py`) and an employee account `david_test`.
- `tests/test_login.py` temporarily disables the `david_test` account and re-enables it at the end.

## How the dashboard maps to DBMS concepts

| Tab | Concepts it shows |
| --- | --- |
| Overview & ER | Relational model, entities and relationships, cardinality (1:1, 1:N, optional vs mandatory), primary and foreign keys, schema statistics, live vs static mode |
| Tables | Columns and data types, NULL / DEFAULT / AUTO_INCREMENT, generated columns, primary and unique keys, secondary indexes, referential actions (`ON DELETE` / `ON UPDATE`), `CHECK` constraints, which tables reference which |
| Query library | The real SQL issued by the backend functions, grouped by kind (lookup, join, aggregate, insert, update, search, auth), with parameterised queries and the concepts each one exercises |
| Query plans | How the optimizer reaches rows: index lookup vs table scan, join order and nested-loop joins, access types. Hand-written plans derived from the declared indexes are labelled illustrative; with a live database the same query can be sent through `EXPLAIN` and the real output is labelled live |
| Why can't I...? | Integrity enforcement: what happens when an operation violates a `CHECK`, unique key, foreign key, `NOT NULL` or generated-column rule (or triggers a referential action), which stage of statement processing stops it, and what the Python backend does first. Scenarios are scripted, and checked against the parsed DDL |
| Transactions | Atomicity, commit and rollback, isolation between two sessions, and how failed statements affect a transaction (scripted scenarios based on InnoDB's documented behaviour, labelled as simulations, not a live trace) |

Exact content of each tab, including which parts are live and which are illustrative, is stated in the UI itself.
