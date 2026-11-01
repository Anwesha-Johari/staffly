import type { ReactNode } from "react";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-flat flex flex-col items-center px-6 py-10 text-center">
      <p className="font-display text-[16px] font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-md text-[13.5px] text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
