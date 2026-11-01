'use server';

import { revalidatePath } from 'next/cache';
import { requireRoles } from '@/lib/session';
import { captureSql } from '@/lib/trace';
import { generatePayroll, updatePaymentStatus } from '@/lib/data/payroll';
import {
  formatPayMonth,
  parsePaymentStatus,
  parsePositiveInt,
  validateGeneratePayroll,
  type GeneratePayrollField,
} from '@/lib/validation/payroll';
import type { GenerateState, StatusState } from './state';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * generate_payroll. Authorisation is re-checked here because Server Actions
 * are reachable by direct POST, whatever the page showed.
 */
export async function generatePayrollAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  await requireRoles(['Admin', 'HR']);

  const checked = validateGeneratePayroll({
    employeeId: text(formData, 'employeeId'),
    payMonth: text(formData, 'payMonth'),
    basicSalary: text(formData, 'basicSalary'),
    allowances: text(formData, 'allowances'),
    deductions: text(formData, 'deductions'),
  });
  if (!checked.ok) {
    return {
      ok: false,
      message: 'Please fix the highlighted fields.',
      errors: checked.errors,
      sql: [],
    };
  }

  const { result, sql } = await captureSql(() => generatePayroll(checked.value));

  if (!result.ok) {
    const errors: Partial<Record<GeneratePayrollField, string>> = {};
    if (result.field === 'employeeId' || result.field === 'deductions') {
      errors[result.field] = result.message;
    }
    return {
      ok: false,
      message: result.message,
      errors,
      unavailable: result.kind === 'unavailable',
      sql,
    };
  }

  revalidatePath('/payroll');
  return {
    ok: true,
    message: `Payslip generated for ${formatPayMonth(checked.value.payMonth)} with status Pending.`,
    payrollId: result.data.payrollId,
    payMonth: checked.value.payMonth,
    netSalary: result.data.netSalary,
    sql,
  };
}

/** update_payroll_status: Paid stamps today's date, Pending and On Hold clear it. */
export async function updatePaymentStatusAction(
  _prev: StatusState,
  formData: FormData,
): Promise<StatusState> {
  await requireRoles(['Admin', 'HR']);

  const payrollId = parsePositiveInt(text(formData, 'payrollId'));
  if (payrollId === null) {
    return { ok: false, message: 'Invalid payroll ID.', payrollId: null, sql: [] };
  }
  const status = parsePaymentStatus(text(formData, 'status'));
  if (status === null) {
    return {
      ok: false,
      message: 'Invalid payment status. Allowed statuses: Pending, Paid, On Hold.',
      payrollId,
      sql: [],
    };
  }

  const { result, sql } = await captureSql(() => updatePaymentStatus(payrollId, status));
  if (!result.ok) {
    return { ok: false, message: result.message, payrollId, sql };
  }

  revalidatePath('/payroll');
  revalidatePath(`/payroll/${payrollId}`);
  return {
    ok: true,
    message:
      status === 'Paid'
        ? `Payslip #${payrollId} marked Paid; payment date set to today by MySQL.`
        : `Payslip #${payrollId} set to ${status}; payment date cleared.`,
    payrollId,
    sql,
  };
}
