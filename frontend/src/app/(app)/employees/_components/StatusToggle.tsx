"use client";

import { useActionState } from "react";
import { ConfirmButton, Notice, SqlTrace } from "@/components/app";
import { IDLE, type EmployeeFormState } from "../form-state";

type Action = (prev: EmployeeFormState, formData: FormData) => Promise<EmployeeFormState>;

/**
 * Deactivate / Reactivate with a two-step confirmation. The server action
 * re-checks the role and the current status; the id posted here is only a
 * request, not an authority.
 */
export function StatusToggle({
  employeeId,
  name,
  mode,
  action,
}: {
  employeeId: number;
  name: string;
  mode: "deactivate" | "reactivate";
  action: Action;
}) {
  const [state, dispatch] = useActionState(action, IDLE);
  const deactivating = mode === "deactivate";

  return (
    <div>
      <form className="inline-flex flex-wrap items-center gap-2">
        <ConfirmButton
          label={deactivating ? "Deactivate" : "Reactivate"}
          confirmLabel={deactivating ? "Yes, deactivate" : "Yes, reactivate"}
          message={
            deactivating
              ? `Mark ${name} as Inactive? Their history is kept.`
              : `Mark ${name} as Active again?`
          }
          danger={deactivating}
          formAction={dispatch}
          name="id"
          value={String(employeeId)}
        />
      </form>
      {state.status !== "idle" && state.message && (
        <Notice kind={state.status === "success" ? "ok" : "bad"} className="mt-3">
          {state.message}
        </Notice>
      )}
      {state.sql && state.sql.length > 0 && <SqlTrace entries={state.sql} title="Under the hood: SQL for this status change" />}
    </div>
  );
}
