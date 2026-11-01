import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { InfoTip } from '@/components/InfoTip';
import {
  DbUnavailable,
  EmptyState,
  Notice,
  PageHeader,
  Pagination,
  SqlTrace,
} from '@/components/app';
import {
  listEmployeeOptions,
  listPayslips,
  payrollTotals,
  type DataResult,
  type PayrollTotals,
  type PayslipRow,
  type PayrollEmployeeOption,
} from '@/lib/data/payroll';
import { requireRoles } from '@/lib/session';
import { captureSql } from '@/lib/trace';
import {
  currentMonthFirstDay,
  formatPayMonth,
  normaliseToFirstOfMonth,
  parsePositiveInt,
  shiftMonth,
} from '@/lib/validation/payroll';
import { GenerateForm } from './GenerateForm';
import { PayslipTable } from './PayslipTable';

export const metadata = { title: 'Payroll' };

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PayrollPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-[13.5px] text-muted">Loading payroll...</p>}>
      <PayrollContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PayrollContent({ searchParams }: { searchParams: SearchParams }) {
  await requireRoles(['Admin', 'HR']);
  // "This month" depends on the request time, so this must never be prerendered.
  await connection();
  const params = await searchParams;

  // Month filter: "all", a valid month, or (default and fallback) this month.
  const rawMonth = first(params.month)?.trim();
  const thisMonth = currentMonthFirstDay();
  const showAll = rawMonth === 'all';
  const parsedMonth = showAll ? null : normaliseToFirstOfMonth(rawMonth);
  const badMonth = rawMonth !== undefined && rawMonth !== '' && !showAll && parsedMonth === null;
  const payMonth = showAll ? null : (parsedMonth ?? thisMonth);

  const requestedPage = parsePositiveInt(first(params.page)) ?? 1;


  const { result, sql } = await captureSql(async () => {
    const totals = await payrollTotals({ employeeId: null, payMonth });
    const pageCount = totals.ok ? Math.max(1, Math.ceil(totals.data.count / PAGE_SIZE)) : 1;
    const page = Math.min(requestedPage, pageCount);
    const list = await listPayslips({
      employeeId: null,
      payMonth,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    const employees: DataResult<PayrollEmployeeOption[]> = await listEmployeeOptions();
    return { totals, list, employees, page, pageCount };
  });

  const { totals, list, employees, page, pageCount } = result;
  if (
    !totals.ok && totals.kind === 'unavailable' ||
    !list.ok && list.kind === 'unavailable'
  ) {
    return (
      <>
        <PageHeader title="Payroll" />
        <DbUnavailable />
      </>
    );
  }

  const rows: PayslipRow[] = list.ok ? list.data : [];
  const totalsData: PayrollTotals | null = totals.ok ? totals.data : null;
  const monthLabel = payMonth ? formatPayMonth(payMonth) : 'All months';
  const monthValue = payMonth ? payMonth.slice(0, 7) : '';

  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    q.set('month', payMonth ? payMonth.slice(0, 7) : 'all');
    if (p > 1) q.set('page', String(p));
    return `/payroll?${q.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Monthly payslips for every employee. Generate a payslip, then track its payment status."
      />

      {employees.ok ? (
        <div className="mb-6">
          <GenerateForm
            employees={employees.data}
            defaultMonth={payMonth ? payMonth.slice(0, 7) : thisMonth.slice(0, 7)}
          />
        </div>
      ) : (
        <Notice kind="warn" className="mb-6">
          The employee list could not be loaded, so payroll cannot be generated right now.
        </Notice>
      )}

      <section aria-labelledby="payslips-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 id="payslips-title" className="text-[17px] font-medium text-ink">
              {monthLabel}
            </h2>
            <InfoTip title="Pay month">
              Each payslip belongs to a month, stored as that month&apos;s first day. Picking any
              month here is converted to its first day before MySQL is asked, so{' '}
              <code>WHERE pay_month = ?</code> matches exactly.
            </InfoTip>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {payMonth && (
              <Link
                href={`/payroll?month=${shiftMonth(payMonth, -1).slice(0, 7)}`}
                className="btn"
                aria-label="Previous month"
              >
                Previous
              </Link>
            )}
            <form action="/payroll" method="get" className="flex items-center gap-2">
              <label htmlFor="pay-month" className="sr-only">
                Pay month
              </label>
              <input
                id="pay-month"
                type="month"
                name="month"
                defaultValue={monthValue}
                key={monthValue}
                className="field !w-auto"
                placeholder="YYYY-MM"
              />
              <button type="submit" className="btn">
                Show
              </button>
            </form>
            {payMonth && (
              <Link
                href={`/payroll?month=${shiftMonth(payMonth, 1).slice(0, 7)}`}
                className="btn"
                aria-label="Next month"
              >
                Next
              </Link>
            )}
            <Link
              href={showAll ? '/payroll' : '/payroll?month=all'}
              className="btn"
            >
              {showAll ? 'This month' : 'All months'}
            </Link>
          </div>
        </div>

        {badMonth && (
          <Notice kind="warn" className="mb-3">
            That is not a valid month. Showing {formatPayMonth(thisMonth)} instead; use the format
            YYYY-MM.
          </Notice>
        )}
        {!list.ok && (
          <Notice kind="bad" className="mb-3">
            {list.message}
          </Notice>
        )}

        {list.ok && rows.length === 0 ? (
          <EmptyState
            title={`No payslips for ${monthLabel}`}
            body="Use Generate payroll above to create one for each employee this month."
          />
        ) : (
          list.ok && (
            <>
              <PayslipTable
                rows={rows}
                totals={totalsData}
                canManage
                showMonth={showAll}
              />
              <Pagination page={page} pageCount={pageCount} makeHref={hrefFor} />
            </>
          )
        )}
      </section>

      <SqlTrace entries={sql} title="Under the hood: SQL for this page" />
    </>
  );
}
