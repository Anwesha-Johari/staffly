import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { DbUnavailable, Notice, PageHeader, SqlTrace, StatusChip } from '@/components/app';
import { getPayslip } from '@/lib/data/payroll';
import { requireRoles } from '@/lib/session';
import { captureSql } from '@/lib/trace';
import { formatAmount, formatPayMonth, parsePositiveInt } from '@/lib/validation/payroll';
import { PrintButton } from '../PrintButton';

export const metadata = { title: 'Payslip' };

export default function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-[13.5px] text-muted">Loading payslip...</p>}>
      <PayslipContent params={params} />
    </Suspense>
  );
}

function Line({
  label,
  value,
  strong,
  info,
}: {
  label: string;
  value: string;
  strong?: boolean;
  info?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="flex items-center gap-1.5 text-[13.5px] text-muted">
        {label}
        {info}
      </dt>
      <dd className={`num-serif tabular-nums ${strong ? 'text-[22px] text-ink' : 'text-[15px] text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}

async function PayslipContent({ params }: { params: Promise<{ id: string }> }) {
  await requireRoles(['Admin', 'HR']);
  const payrollId = parsePositiveInt((await params).id);
  if (payrollId === null) notFound();

  const { result, sql } = await captureSql(() => getPayslip(payrollId));

  if (!result.ok) {
    return (
      <>
        <PageHeader title="Payslip" />
        {result.kind === 'unavailable' ? (
          <DbUnavailable />
        ) : (
          <Notice kind="bad">{result.message}</Notice>
        )}
      </>
    );
  }
  const slip = result.data;
  if (!slip) notFound();

  return (
    <>
      <PageHeader
        title="Payslip"
        description={`${slip.employeeName}, ${formatPayMonth(slip.payMonth)}`}
        actions={
          <>
            <Link href={`/payroll?month=${slip.payMonth.slice(0, 7)}`} className="btn print:hidden">
              Back to payroll
            </Link>
            <PrintButton />
          </>
        }
      />

      <article
        className="card max-w-xl p-6 print:max-w-none print:rounded-none print:border-0 print:p-0"
        aria-label={`Payslip for ${slip.employeeName}, ${formatPayMonth(slip.payMonth)}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <p className="font-display text-[20px] font-medium text-ink">{slip.employeeName}</p>
            <p className="text-[13px] text-muted">
              {[slip.jobTitle, slip.department].filter(Boolean).join(', ') || 'No role or department on file'}
            </p>
            {slip.email && <p className="text-[13px] text-faint">{slip.email}</p>}
          </div>
          <div className="text-right">
            <p className="eyebrow">Pay month</p>
            <p className="font-display text-[16px] text-ink">{formatPayMonth(slip.payMonth)}</p>
            <p className="mt-1 text-[12px] text-faint">Payslip #{slip.payrollId}</p>
          </div>
        </div>

        <dl className="mt-2">
          <Line label="Basic salary" value={formatAmount(slip.basicSalary)} />
          <Line label="Allowances" value={`+ ${formatAmount(slip.allowances)}`} />
          <Line label="Deductions" value={`- ${formatAmount(slip.deductions)}`} />
          <Line
            label="Net salary"
            value={formatAmount(slip.netSalary)}
            strong
            info={
              <InfoTip title="Computed by MySQL" side="top">
                <code>net_salary</code> is a generated, stored column: MySQL calculated basic +
                allowances - deductions when this row was written. The application never sets it.
              </InfoTip>
            }
          />
        </dl>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[13px] text-muted">
          <span className="inline-flex items-center gap-2">
            Payment status <StatusChip status={slip.paymentStatus} />
          </span>
          <span>{slip.paymentDate ? `Paid on ${slip.paymentDate}` : 'Not paid yet'}</span>
        </div>
      </article>

      <div className="print:hidden">
        <SqlTrace entries={sql} title="Under the hood: SQL for this payslip" />
      </div>
    </>
  );
}
