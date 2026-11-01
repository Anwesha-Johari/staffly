import Link from "next/link";
import { Suspense } from "react";
import { DbUnavailable, PageHeader, SqlTrace } from "@/components/app";
import { isConnectionError, listDepartmentOptions, listManagerOptions, listRoleOptions } from "@/lib/data/employees";
import { captureSql } from "@/lib/trace";
import { EMPTY_VALUES } from "@/lib/validation/employee";
import { createEmployeeAction } from "../actions";
import { EmployeeForm } from "../_components/EmployeeForm";

export default function NewEmployeePage() {
  return (
    <>
      <Suspense fallback={<PageHeader title="Add employee" />}>
        <NewEmployeeContent />
      </Suspense>
    </>
  );
}

async function NewEmployeeContent() {
  let data;
  try {
    data = await captureSql(async () => ({
      departments: await listDepartmentOptions(),
      roles: await listRoleOptions(),
      managers: await listManagerOptions(),
    }));
  } catch (error) {
    if (isConnectionError(error)) {
      return (
        <>
          <PageHeader title="Add employee" />
          <DbUnavailable error={error} />
        </>
      );
    }
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Add employee"
        description="Creates one row in the employees table. The server checks every field again before saving."
        actions={
          <Link href="/employees" className="btn">
            Back to employees
          </Link>
        }
      />
      <div className="card max-w-3xl p-6">
        <EmployeeForm
          mode="create"
          action={createEmployeeAction}
          initial={{ ...EMPTY_VALUES, hire_date: today }}
          departments={data.result.departments}
          roles={data.result.roles}
          managers={data.result.managers}
        />
      </div>
      <div className="max-w-3xl">
        <SqlTrace entries={data.sql} title="Under the hood: SQL that filled the dropdowns" />
      </div>
    </>
  );
}
