import type { AttendanceDay } from "@/lib/data/attendance";
import type { AttendanceStatus, MonthRange } from "@/lib/validation/attendance";
import { StatusChip } from "@/components/app";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Cell fills use the same tokens as the status chips: flat colour, 1px border. */
const CELL: Record<AttendanceStatus, { box: string; text: string }> = {
  Present: { box: "bg-ok-soft border-[var(--ok-line)]", text: "text-ok" },
  Absent: { box: "bg-bad-soft border-[var(--bad-line)]", text: "text-bad" },
  "Half Day": { box: "bg-warn-soft border-[var(--warn-line)]", text: "text-warn" },
  Holiday: { box: "bg-surface-2 border-line-strong", text: "text-muted" },
};

function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : "--:--";
}

/**
 * A calendar-style month. The status is written out in every recorded cell
 * (colour is never the only signal) with the mono check-in / check-out below.
 */
export function MonthGrid({ month, days }: { month: MonthRange; days: AttendanceDay[] }) {
  const byDay = new Map<number, AttendanceDay>();
  for (const d of days) byDay.set(Number(d.date.slice(8, 10)), d);

  const cells: Array<number | null> = [
    ...Array.from({ length: month.firstWeekday }, () => null),
    ...Array.from({ length: month.daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-1.5">
          <caption className="sr-only">Attendance for {month.label}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((w) => (
                <th key={w} scope="col" className="pb-1 text-left text-[12px] font-medium text-muted">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  if (day === null) return <td key={di} className="h-[84px] rounded-lg bg-surface-2/50" />;
                  const rec = byDay.get(day);
                  if (!rec) {
                    return (
                      <td
                        key={di}
                        className="h-[84px] rounded-lg border border-line align-top p-2"
                        aria-label={`${month.label.split(" ")[0]} ${day}: not recorded`}
                      >
                        <span className="num-serif text-[15px] text-faint">{day}</span>
                      </td>
                    );
                  }
                  const style = CELL[rec.status];
                  return (
                    <td
                      key={di}
                      className={`h-[84px] rounded-lg border align-top p-2 ${style.box}`}
                      aria-label={`${month.label.split(" ")[0]} ${day}: ${rec.status}, ${hhmm(rec.checkIn)} to ${hhmm(rec.checkOut)}`}
                    >
                      <span className="num-serif block text-[15px] text-ink">{day}</span>
                      <span className={`block text-[12px] font-medium ${style.text}`}>{rec.status}</span>
                      <span className="mono block text-[11px] text-muted">
                        {hhmm(rec.checkIn)} - {hhmm(rec.checkOut)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted" aria-label="Legend">
        {(["Present", "Absent", "Half Day", "Holiday"] as const).map((s) => (
          <li key={s} className="inline-flex items-center gap-1.5">
            <StatusChip status={s} />
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-line" aria-hidden="true" />
          Not recorded
        </li>
      </ul>
    </div>
  );
}
