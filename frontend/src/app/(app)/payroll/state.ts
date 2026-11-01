import type { QueryLogEntry } from '@/lib/db';
import type { GeneratePayrollField } from '@/lib/validation/payroll';

/** Result of the "Generate payroll" form action. Serializable; never holds secrets. */
export type GenerateState =
  | {
      ok: true;
      message: string;
      payrollId: number;
      payMonth: string;
      netSalary: string;
      sql: QueryLogEntry[];
    }
  | {
      ok: false;
      message: string;
      errors: Partial<Record<GeneratePayrollField, string>>;
      unavailable?: boolean;
      sql: QueryLogEntry[];
    }
  | null;

/** Result of a payment-status change. */
export type StatusState =
  | {
      ok: boolean;
      message: string;
      payrollId: number | null;
      sql: QueryLogEntry[];
    }
  | null;
