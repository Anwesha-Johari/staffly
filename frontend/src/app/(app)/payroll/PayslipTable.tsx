'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { ConfirmButton, Notice, SqlTrace, StatusChip } from '@/components/app';
import type { PayrollTotals, PayslipRow } from '@/lib/data/payroll';
import { formatAmount, formatPayMonth } from '@/lib/validation/payroll';
import { updatePaymentStatusAction } from './actions';

/**
 * Payslip table with per-row payment-status actions (`canManage`).
 * All rows share one action state so the latest result and its SQL trace
 * appear once, below the table.
 */
export function PayslipTable({
  rows,
  totals,
  canManage,
  showMonth,
}: {
  rows: PayslipRow[];
  /** Null hides the totals row. */
  totals: PayrollTotals | null;
  canManage: boolean;
  showMonth: boolean;
}) {
  const [state, dispatch, pending] = useActionState(updatePaymentStatusAction, null);

  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <caption className="sr-only">Payslips</caption>
          <thead>
            <tr>
              <th scope="col">Employee</th>
              {showMonth && <th scope="col">Month</th>}
              <th scope="col" className="text-right">Basic</th>
              <th scope="col" className="text-right">Allowances</th>
              <th scope="col" className="text-right">Deductions</th>
              <th scope="col" className="text-right">
                <span className="inline-flex items-center justify-end gap-1.5">
                  Net
                  <InfoTip title="Read-only: computed by MySQL" align="end">
                    <code>net_salary</code> is a <code>GENERATED ALWAYS ... STORED</code> column.
                    MySQL computes basic + allowances - deductions whenever a row is written, so
                    this page can only display it, never edit it.
                  </InfoTip>
                </span>
              </th>
              <th scope="col">
                <span className="inline-flex items-center gap-1.5">
                  Status
                  <InfoTip title="Payment status" align="end">
                    A <code>CHECK</code> constraint limits it to Pending, Paid or On Hold. Marking a
                    payslip Paid also records today&apos;s date; the other two clear the date.
                  </InfoTip>
                </span>
              </th>
              <th scope="col">Paid on</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.payrollId} className={state?.ok && state.payrollId === r.payrollId ? 'bg-ok-soft' : undefined}>
                <td className="text-ink">
                  <Link
                    href={`/payroll/${r.payrollId}`}
                    className="text-ink underline decoration-line-strong underline-offset-2 hover:text-accent"
                  >
                    {r.employeeName}
                  </Link>
                </td>
                {showMonth && <td className="whitespace-nowrap text-muted">{formatPayMonth(r.payMonth)}</td>}
                <td className="text-right tabular-nums">{formatAmount(r.basicSalary)}</td>
                <td className="text-right tabular-nums">{formatAmount(r.allowances)}</td>
                <td className="text-right tabular-nums">{formatAmount(r.deductions)}</td>
                <td className="num-serif text-right text-ink">{formatAmount(r.netSalary)}</td>
                <td>
                  <StatusChip status={r.paymentStatus} />
                </td>
                <td className="whitespace-nowrap text-muted">{r.paymentDate ?? '-'}</td>
                <td>
                  {canManage && (
                    <form action={dispatch} className="flex flex-wrap items-center justify-end gap-1.5">
                      <input type="hidden" name="payrollId" value={r.payrollId} />
                      {r.paymentStatus !== 'Paid' && (
                        <ConfirmButton
                          label="Mark paid"
                          confirmLabel="Mark paid"
                          message={`Mark ${r.employeeName}'s payslip as Paid today?`}
                          name="status"
                          value="Paid"
                          danger={false}
                        />
                      )}
                      {r.paymentStatus !== 'On Hold' && (
                        <button
                          type="submit"
                          name="status"
                          value="On Hold"
                          className="btn"
                          disabled={pending}
                          aria-label={`Put ${r.employeeName}'s payslip on hold`}
                        >
                          Hold
                        </button>
                      )}
                      {r.paymentStatus !== 'Pending' && (
                        <button
                          type="submit"
                          name="status"
                          value="Pending"
                          className="btn"
                          disabled={pending}
                          aria-label={`Set ${r.employeeName}'s payslip back to pending`}
                        >
                          Pending
                        </button>
                      )}
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {totals && (
            <tfoot>
              <tr className="bg-surface-2">
                <td className="font-medium text-ink">
                  <span className="inline-flex items-center gap-1.5">
                    Total ({totals.count} payslip{totals.count === 1 ? '' : 's'})
                    <InfoTip title="Totals come from MySQL">
                      These are <code>SUM()</code> aggregates over every payslip matching the
                      current filter, not just the rows on this page.
                    </InfoTip>
                  </span>
                </td>
                {showMonth && <td />}
                <td className="text-right font-medium tabular-nums">{formatAmount(totals.basic)}</td>
                <td className="text-right font-medium tabular-nums">{formatAmount(totals.allowances)}</td>
                <td className="text-right font-medium tabular-nums">{formatAmount(totals.deductions)}</td>
                <td className="num-serif text-right text-ink">{formatAmount(totals.net)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-3" aria-live="polite">
        {state && <Notice kind={state.ok ? 'ok' : 'bad'}>{state.message}</Notice>}
      </div>
      {state && state.sql.length > 0 && (
        <SqlTrace entries={state.sql} title="Under the hood: SQL for this status change" />
      )}
    </div>
  );
}
