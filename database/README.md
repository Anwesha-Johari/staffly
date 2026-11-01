# Staffly database

MySQL 8 schema for the Staffly employee management system.

| File | Purpose |
| --- | --- |
| `schemas.sql` | DDL for the `employee_management` database (7 tables, constraints, generated `payroll.net_salary`). |
| `demo_seed.sql` | Fake demo data for **local development only**. |
| `emsDB.sql` | Scratch query file (see below). Not part of setup. |

## Create the schema

```bash
mysql -u root -p < database/schemas.sql
```

This creates the `employee_management` database (if missing) and all tables. It uses `CREATE ... IF NOT EXISTS`, so it is safe to re-run.

## Load the demo seed

```bash
mysql -u root -p employee_management < database/demo_seed.sql
```

> **Demo data only.** Never run `demo_seed.sql` against a real, shared, staging or production database. It inserts fixed primary keys and publicly documented credentials, and it is meant for an **empty** database. Running it twice fails on duplicate keys.

What it loads:

| Table | Rows |
| --- | --- |
| `departments` | 6 |
| `job_roles` | 10 (with salary bands) |
| `employees` | 28 (manager hierarchy; Active, Inactive and On Leave) |
| `user_accounts` | 3 |
| `attendance` | 300 (12 employees x 25 weekdays, 2026-09-25 to 2026-10-29) |
| `leave_requests` | 14 (Pending, Approved, Rejected) |
| `payroll` | 60 (20 employees x 2026-08, 2026-09, 2026-10) |

## Demo accounts

The seed also inserts three rows in `user_accounts` (`demo_admin`, `demo_hr`, `demo_employee`, demo password `Staffly-Demo-2026!`, bcrypt cost 10) so the Python backend and Streamlit app can log in. The web dashboard has no sign-in for now and does not use them. These credentials are public and exist only in seed data; do not reuse them anywhere real.

## Reset the demo database

Drop the database, then recreate the schema and reload the seed:

```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS employee_management;"
mysql -u root -p < database/schemas.sql
mysql -u root -p employee_management < database/demo_seed.sql
```

`DROP DATABASE` permanently deletes everything in `employee_management`. Only do this on a local demo database.

## What is `emsDB.sql`?

A scratch file of ad hoc queries used while developing: `USE employee_management;`, a `SELECT * FROM` for each of the seven tables, `SHOW TABLES;` and a `DESCRIBE` for each table. It creates and modifies nothing, and is not needed to set up or seed the database.
