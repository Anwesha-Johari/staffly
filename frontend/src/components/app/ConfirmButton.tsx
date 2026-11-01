"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton({
  label,
  danger,
  formAction,
  buttonRef,
}: {
  label: ReactNode;
  danger: boolean;
  formAction?: (formData: FormData) => void | Promise<void>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      ref={buttonRef}
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
    >
      {pending ? "Working..." : label}
    </button>
  );
}

/**
 * Two-step confirmation for destructive actions. Place it inside a <form>:
 * the first click only arms it; the second ("Confirm") submits the form,
 * optionally through `formAction` (a Server Action). Escape or Cancel disarms.
 *
 *   <form><ConfirmButton label="Deactivate" message="Deactivate Priya Nair?"
 *         formAction={deactivate} name="id" value="12" /></form>
 */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  message = "Are you sure?",
  formAction,
  name,
  value,
  danger = true,
  disabled,
}: {
  label: ReactNode;
  confirmLabel?: ReactNode;
  message?: ReactNode;
  formAction?: (formData: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const armRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!armed) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setArmed(false);
        armRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [armed]);

  if (!armed) {
    return (
      <button
        ref={armRef}
        type="button"
        disabled={disabled}
        onClick={() => setArmed(true)}
        className={`btn ${danger ? "btn-danger" : ""}`}
      >
        {label}
      </button>
    );
  }

  return (
    <span role="group" aria-label="Confirm action" className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-muted" role="status">
        {message}
      </span>
      {/* A hidden field, not the button's own name/value: it reaches the server action reliably. */}
      {name && value !== undefined && <input type="hidden" name={name} value={value} />}
      <SubmitButton label={confirmLabel} danger={danger} formAction={formAction} buttonRef={confirmRef} />
      <button type="button" className="btn" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </span>
  );
}
