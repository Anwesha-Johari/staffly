import type { ReactNode } from "react";

/**
 * The visible "what am I looking at" box at the top of every under-the-hood tab.
 * Keep it short and plain: two or three sentences a first-year student can read.
 * Deeper detail belongs in <InfoTip>, not here.
 *
 *   <Explainer title="Entity-relationship diagram" tryThis="Hover a table.">
 *     Each box is a table...
 *   </Explainer>
 */
export function Explainer({
  title,
  children,
  tryThis,
  steps,
}: {
  title: string;
  children: ReactNode;
  /** One concrete action the reader can do right now. */
  tryThis?: string;
  /** "How to read it": at most 4 short numbered points, matching numbered markers on the visual. */
  steps?: string[];
}) {
  return (
    <section className="rounded-xl bg-surface-2 p-5" aria-label={`About: ${title}`}>
      <h2 className="text-[15px] font-medium text-ink">{title}</h2>
      <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed text-muted">{children}</p>
      {steps && steps.length > 0 && (
        <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-[13px] text-muted sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-0.5 inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-medium text-accent">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
      {tryThis && (
        <p className="mt-3 text-[13px] text-muted">
          <span className="mr-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-accent">Try this</span>
          {tryThis}
        </p>
      )}
    </section>
  );
}
