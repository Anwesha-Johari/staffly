'use server';

import { revalidatePath } from 'next/cache';
import { captureSql } from '@/lib/trace';
import { markAttendance } from '@/lib/data/attendance';
import { validateMarkAttendance, type MarkAttendanceRaw } from '@/lib/validation/attendance';
import type { MarkState } from './state';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/**
 * mark_attendance. Authentication is currently removed from the product, so
 * anyone can record any active employee's day; the employee id is validated
 * and checked against the employees table like every other field.
 */
export async function markAttendanceAction(_prev: MarkState, formData: FormData): Promise<MarkState> {
  const raw: MarkAttendanceRaw = {
    employeeId: text(formData, 'employeeId'),
    date: text(formData, 'date'),
    status: text(formData, 'status'),
    checkIn: text(formData, 'checkIn'),
    checkOut: text(formData, 'checkOut'),
  };

  const checked = validateMarkAttendance(raw);
  if (!checked.ok) {
    return {
      ok: false,
      message: 'Please fix the highlighted fields.',
      errors: checked.errors,
      values: raw,
      sql: [],
    };
  }

  const { result, sql } = await captureSql(() => markAttendance(checked.value));

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      errors: {},
      values: raw,
      duplicate: result.kind === 'duplicate',
      unavailable: result.kind === 'unavailable',
      sql,
    };
  }

  revalidatePath('/attendance');
  return {
    ok: true,
    message: `Attendance recorded: ${checked.value.status} on ${checked.value.date}.`,
    errors: {},
    // Keep the employee and date for quick entry of the next person; clear the rest.
    values: { ...raw, status: 'Present', checkIn: '', checkOut: '' },
    sql,
  };
}
