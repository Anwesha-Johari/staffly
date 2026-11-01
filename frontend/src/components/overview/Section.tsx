import type { ReactNode } from "react";
import { InfoTip } from "../InfoTip";

/** Card with a heading row: title, optional InfoTip, optional right-hand slot. */
export function Section({
  id,
  title,
  tip,
  tipTitle,
  right,
  children,
}: {
  id?: string;
  title: string;
  tip?: ReactNode;
  tipTitle?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-4 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2 text-[16px] font-medium text-ink">
          {title}
          {tip && (
            <InfoTip title={tipTitle ?? title} side="bottom">
              {tip}
            </InfoTip>
          )}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}
