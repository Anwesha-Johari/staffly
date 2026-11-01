import type { QueryLogEntry } from '@/lib/db';
import type { ApplyField, ApplyLeaveRaw } from '@/lib/validation/leave';

/** Result of the "Apply for leave" form action. Echoes the submitted values so the form keeps them on error. */
export type ApplyState =
  | {
      ok: boolean;
      message: string;
      errors: Partial<Record<ApplyField, string>>;
      values: ApplyLeaveRaw;
      sql: QueryLogEntry[];
    }
  | null;

/** Result of an Approve / Reject click. */
export type ReviewState =
  | {
      ok: boolean;
      /** True when the compare-and-set matched no Pending row (someone else decided first). */
      raced?: boolean;
      message: string;
      leaveId: number | null;
      sql: QueryLogEntry[];
    }
  | null;
