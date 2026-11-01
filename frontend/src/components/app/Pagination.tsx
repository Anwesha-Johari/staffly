import Link from "next/link";

function windowed(page: number, pageCount: number): Array<number | "gap"> {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** Previous / numbered / next links. Renders nothing for a single page. */
export function Pagination({
  page,
  pageCount,
  makeHref,
}: {
  page: number;
  pageCount: number;
  makeHref: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const item = "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px]";
  const idle = `${item} border-line text-muted hover:bg-surface-2 hover:text-ink`;

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12.5px] text-muted">
        Page {page} of {pageCount}
      </p>
      <ul className="flex items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={makeHref(page - 1)} className={idle} rel="prev">
              Previous
            </Link>
          ) : (
            <span className={`${item} border-line text-faint`} aria-disabled="true">
              Previous
            </span>
          )}
        </li>
        {windowed(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-faint" aria-hidden="true">
              ...
            </li>
          ) : (
            <li key={p}>
              {p === page ? (
                <span aria-current="page" className={`${item} border-accent text-accent`}>
                  {p}
                </span>
              ) : (
                <Link href={makeHref(p)} className={idle} aria-label={`Page ${p}`}>
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < pageCount ? (
            <Link href={makeHref(page + 1)} className={idle} rel="next">
              Next
            </Link>
          ) : (
            <span className={`${item} border-line text-faint`} aria-disabled="true">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
