import type { QueryLogEntry } from '@/lib/db';
import type { EmployeeFormValues, FieldErrors } from '@/lib/validation/employee';

/** What every employee server action returns to useActionState. */
export interface EmployeeFormState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: FieldErrors;
  /** The submitted values, so the form can be re-filled after an error. */
  values?: Partial<EmployeeFormValues>;
  /** Id of the employee that was created or changed. */
  id?: number;
  /** Statements the action ran, for the "Under the hood" trace. */
  sql?: QueryLogEntry[];
}

export const IDLE: EmployeeFormState = { status: 'idle' };
