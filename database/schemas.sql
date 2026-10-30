-- Staffly Database Schema
-- Database: employee_management

CREATE DATABASE IF NOT EXISTS employee_management;
USE employee_management;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  department_id INT NOT NULL AUTO_INCREMENT,
  department_name VARCHAR(100) NOT NULL,
  location VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (department_id),
  UNIQUE KEY uq_department_name (department_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. Job Roles Table
CREATE TABLE IF NOT EXISTS job_roles (
  role_id INT NOT NULL AUTO_INCREMENT,
  role_title VARCHAR(100) NOT NULL,
  min_salary DECIMAL(10,2) DEFAULT NULL,
  max_salary DECIMAL(10,2) DEFAULT NULL,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_role_title (role_title),
  CONSTRAINT chk_role_salary CHECK (
    ((min_salary IS NULL) OR (min_salary >= 0)) AND
    ((max_salary IS NULL) OR (max_salary >= 0)) AND
    ((min_salary IS NULL) OR (max_salary IS NULL) OR (min_salary <= max_salary))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  employee_id INT NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  hire_date DATE NOT NULL,
  salary DECIMAL(10,2) NOT NULL,
  department_id INT DEFAULT NULL,
  role_id INT DEFAULT NULL,
  manager_id INT DEFAULT NULL,
  employment_status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id),
  UNIQUE KEY uq_employee_email (email),
  KEY fk_employee_department (department_id),
  KEY fk_employee_role (role_id),
  KEY fk_employee_manager (manager_id),
  CONSTRAINT fk_employee_department FOREIGN KEY (department_id) REFERENCES departments (department_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_employee_manager FOREIGN KEY (manager_id) REFERENCES employees (employee_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_employee_role FOREIGN KEY (role_id) REFERENCES job_roles (role_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_employee_salary CHECK (salary >= 0),
  CONSTRAINT chk_employment_status CHECK (employment_status IN ('Active', 'Inactive', 'On Leave'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. User Accounts Table
CREATE TABLE IF NOT EXISTS user_accounts (
  account_id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  access_role VARCHAR(20) NOT NULL DEFAULT 'Employee',
  account_status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT NULL,
  PRIMARY KEY (account_id),
  UNIQUE KEY uq_account_employee (employee_id),
  UNIQUE KEY uq_account_username (username),
  CONSTRAINT fk_account_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_access_role CHECK (access_role IN ('Admin', 'HR', 'Employee')),
  CONSTRAINT chk_account_status CHECK (account_status IN ('Active', 'Disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  check_in TIME DEFAULT NULL,
  check_out TIME DEFAULT NULL,
  attendance_status VARCHAR(20) NOT NULL,
  PRIMARY KEY (attendance_id),
  UNIQUE KEY uq_employee_attendance (employee_id, attendance_date),
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_attendance_status CHECK (attendance_status IN ('Present', 'Absent', 'Half Day', 'Holiday')),
  CONSTRAINT chk_attendance_time CHECK ((check_in IS NULL) OR (check_out IS NULL) OR (check_out >= check_in))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  leave_id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  leave_type VARCHAR(30) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  leave_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (leave_id),
  KEY fk_leave_employee (employee_id),
  KEY fk_leave_reviewer (reviewed_by),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_leave_reviewer FOREIGN KEY (reviewed_by) REFERENCES employees (employee_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_leave_status CHECK (leave_status IN ('Pending', 'Approved', 'Rejected'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 7. Payroll Table
CREATE TABLE IF NOT EXISTS payroll (
  payroll_id INT NOT NULL AUTO_INCREMENT,
  employee_id INT NOT NULL,
  pay_month DATE NOT NULL,
  basic_salary DECIMAL(10,2) NOT NULL,
  allowances DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  deductions DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  net_salary DECIMAL(10,2) GENERATED ALWAYS AS (((basic_salary + allowances) - deductions)) STORED,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
  payment_date DATE DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (payroll_id),
  UNIQUE KEY uq_employee_pay_month (employee_id, pay_month),
  CONSTRAINT fk_payroll_employee FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_payment_status CHECK (payment_status IN ('Pending', 'Paid', 'On Hold')),
  CONSTRAINT chk_payroll_amounts CHECK (
    (basic_salary >= 0) AND
    (allowances >= 0) AND
    (deductions >= 0) AND
    ((basic_salary + allowances) >= deductions)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

