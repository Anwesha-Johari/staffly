"use client";

import Link from "next/link";
import { createContext, useActionState, useContext, type ReactNode } from "react";
import { ConfirmButton, Notice, SqlTrace } from "@/components/app";
import { reviewLeaveAction } from "../actions";

const ReviewContext = createContext<{ formAction: (formData: FormData) => void; pending: boolean } | null>(null);

/**
 * Holds the single Approve / Reject action for the whole table, so the result
 * (and the SQL it ran) appears once above the list instead of in every row.
 */
export function ReviewProvider({ children }: { children: ReactNode }) {
  const [state, formAction, pending] = useActionState(reviewLeaveAction, null);

  return (
    <ReviewContext.Provider value={{ formAction, pending }}>
      <div aria-live="polite" className="mb-4 empty:hidden">
        {state && state.ok && <Notice kind="ok">{state.message}</Notice>}
        {state && !state.ok && (
          <Notice kind={state.raced ? "warn" : "bad"}>
            {state.message}
            {state.raced && (
              <>
                {" "}
                <Link href="/under-the-hood#transactions" className="underline underline-offset-2">
                  Why this happens
                </Link>
                .
              </>
            )}
          </Notice>
        )}
      </div>
      {children}
      {state && state.sql.length > 0 && <SqlTrace entries={state.sql} title="Under the hood: SQL for the last review" />}
    </ReviewContext.Provider>
  );
}

/** Approve / Reject for one Pending row. The server re-checks the status; this only submits an id and a decision. */
export function ReviewButtons({ leaveId, employeeName }: { leaveId: number; employeeName: string }) {
  const ctx = useContext(ReviewContext);
  if (!ctx) return null;
  return (
    <form action={ctx.formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leaveId" value={leaveId} />
      <button
        type="submit"
        name="decision"
        value="Approved"
        className="btn"
        disabled={ctx.pending}
        aria-label={`Approve request ${leaveId} from ${employeeName}`}
      >
        Approve
      </button>
      <ConfirmButton
        label="Reject"
        message={`Reject request ${leaveId}?`}
        name="decision"
        value="Rejected"
        disabled={ctx.pending}
      />
    </form>
  );
}
