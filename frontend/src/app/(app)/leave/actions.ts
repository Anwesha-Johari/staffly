'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/session';
import { captureSql } from '@/lib/trace';
import { applyForLeave, reviewLeaveRequest } from '@/lib/data/leave';
import {
  parseId,
  parseLeaveDecision,
  validateApplyLeave,
  type ApplyField,
  type ApplyLeaveRaw,
} from '@/lib/validation/leave';
import type { ApplyState, ReviewState } from './state';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

/** apply_for_leave. The applicant comes from the form's employee select; status starts as Pending. */
export async function applyForLeaveAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const raw: ApplyLeaveRaw = {
    employeeId: text(formData, 'employeeId'),
    leaveType: text(formData, 'leaveType'),
    startDate: text(formData, 'startDate'),
    endDate: text(formData, 'endDate'),
    reason: text(formData, 'reason'),
  };

  const checked = validateApplyLeave(raw);
  if (!checked.ok) {
    return { ok: false, message: 'Please fix the highlighted fields.', errors: checked.errors, values: raw, sql: [] };
  }

  const { result, sql } = await captureSql(() => applyForLeave(checked.value));
  if (!result.ok) {
    const errors: Partial<Record<ApplyField, string>> = {};
    if (result.field === 'endDate') errors.endDate = result.message;
    return { ok: false, message: result.message, errors, values: raw, sql };
  }

  revalidatePath('/leave');
  return {
    ok: true,
    message: `Leave request #${result.data.leaveId} submitted with status Pending.`,
    errors: {},
    values: { ...raw, leaveType: 'Annual', startDate: '', endDate: '', reason: '' },
    sql,
  };
}

/**
 * review_leave_request: a compare-and-set UPDATE ... WHERE leave_status =
 * 'Pending'. The reviewer recorded in reviewed_by is the session employee, not
 * anything submitted by the form.
 */
export async function reviewLeaveAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const session = await requireSession();

  const leaveId = parseId(text(formData, 'leaveId'));
  if (leaveId === null) return { ok: false, message: 'Invalid leave ID.', leaveId: null, sql: [] };
  const decision = parseLeaveDecision(text(formData, 'decision'));
  if (decision === null) {
    return { ok: false, message: 'Invalid leave decision. Choose Approved or Rejected.', leaveId, sql: [] };
  }

  const { result, sql } = await captureSql(() => reviewLeaveRequest(leaveId, decision, session.employeeId));
  if (!result.ok) return { ok: false, message: result.message, leaveId, sql };

  const outcome = result.data;
  if (outcome.outcome === 'not-found') {
    return { ok: false, message: `Leave request #${leaveId} does not exist.`, leaveId, sql };
  }
  if (outcome.outcome === 'already-reviewed') {
    revalidatePath('/leave');
    return {
      ok: false,
      raced: true,
      message: `Already reviewed by someone else: request #${leaveId} is now ${outcome.status}${
        outcome.reviewerName ? ` (by ${outcome.reviewerName})` : ''
      }. Your click changed nothing.`,
      leaveId,
      sql,
    };
  }

  revalidatePath('/leave');
  return { ok: true, message: `Request #${leaveId} ${decision.toLowerCase()}.`, leaveId, sql };
}
