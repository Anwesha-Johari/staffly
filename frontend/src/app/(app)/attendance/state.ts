import type { QueryLogEntry } from '@/lib/db';
import type { MarkAttendanceRaw, MarkField } from '@/lib/validation/attendance';

/** Result of the "Mark attendance" form action. Serializable; echoes the submitted values so the form can keep them. */
export type MarkState =
  | {
      ok: boolean;
      message: string;
      errors: Partial<Record<MarkField, string>>;
      values: MarkAttendanceRaw;
      /** True when MySQL's unique key refused a second row for the same employee and day. */
      duplicate?: boolean;
      unavailable?: boolean;
      sql: QueryLogEntry[];
    }
  | null;
