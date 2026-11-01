'use server';

import { revalidatePath } from 'next/cache';
import { requireRoles } from '@/lib/session';
import { captureSql } from '@/lib/trace';
import {
  createEmployee,
  setEmployeeActive,
  updateEmployee,
  type MutationResult,
} from '@/lib/data/employees';
import {
  readEmployeeForm,
  validateEmployee,
  parsePositiveInt,
} from '@/lib/validation/employee';
import type { EmployeeFormState } from './form-state';

/**
 * Every action re-checks the caller's role on the server (Server Actions are
 * plain POST endpoints), re-validates the input, and only then touches the
 * database through parameterised SQL inside a transaction.
 */

function toState(
  r: MutationResult,
  sql: EmployeeFormState['sql'],
  values: EmployeeFormState['values']
): EmployeeFormState {
  if (r.ok) return { status: 'success', message: r.message, id: r.id, sql };
  return { status: 'error', message: r.message, errors: r.errors, values, sql };
}

/** add_employee (Admin and HR only). */
export async function createEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  await requireRoles(['Admin', 'HR']);

  const raw = readEmployeeForm(formData);
  const parsed = validateEmployee(raw, { mode: 'create' });
  if (!parsed.ok) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: parsed.errors, values: raw };
  }

  const { result, sql } = await captureSql(() => createEmployee(parsed.value));
  if (result.ok) revalidatePath('/employees', 'layout');
  return toState(result, sql, raw);
}

/** update_employee (Admin and HR only). The target id is validated; the role is not taken from the form. */
export async function updateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  await requireRoles(['Admin', 'HR']);

  const id = parsePositiveInt(formData.get('employee_id')?.toString(), 0);
  const raw = readEmployeeForm(formData);
  if (!id) return { status: 'error', message: 'Invalid employee ID.', values: raw };

  const parsed = validateEmployee(raw, { mode: 'update', selfId: id });
  if (!parsed.ok) {
    return { status: 'error', message: 'Please fix the highlighted fields.', errors: parsed.errors, values: raw };
  }

  const { result, sql } = await captureSql(() => updateEmployee(id, parsed.value));
  if (result.ok) revalidatePath('/employees', 'layout');
  return toState(result, sql, raw);
}

async function toggle(formData: FormData, makeActive: boolean): Promise<EmployeeFormState> {
  await requireRoles(['Admin', 'HR']);
  const id = parsePositiveInt(formData.get('id')?.toString(), 0);
  if (!id) return { status: 'error', message: 'Invalid employee ID.' };

  const { result, sql } = await captureSql(() => setEmployeeActive(id, makeActive));
  if (result.ok) revalidatePath('/employees', 'layout');
  return toState(result, sql, undefined);
}

/** deactivate_employee (Admin and HR only). */
export async function deactivateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  return toggle(formData, false);
}

/** reactivate_employee (Admin and HR only). */
export async function reactivateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  return toggle(formData, true);
}
