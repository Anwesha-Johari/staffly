import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";

/**
 * Label + control + hint + error, wired together for assistive tech.
 * `htmlFor` must equal the control's `id`. The first element child receives
 * aria-describedby (hint/error) and aria-invalid (when `error` is set).
 */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  info,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: ReactNode;
  /** Content for an InfoTip shown next to the label. */
  info?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const nodes = Children.toArray(children);
  const target = nodes.findIndex((c) => isValidElement(c) && typeof c.type !== "symbol");
  const control = nodes.map((child, i) => {
    if (i !== target || !isValidElement(child)) return child;
    const props = child.props as Record<string, unknown>;
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      "aria-describedby": [props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
      "aria-invalid": error ? true : props["aria-invalid"],
    });
  });

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <label htmlFor={htmlFor} className="field-label !mb-0">
          {label}
          {required && <span className="ml-0.5 text-accent" aria-hidden="true">*</span>}
        </label>
        {info && <InfoTip title={label}>{info}</InfoTip>}
      </div>
      {control}
      {hint && (
        <p id={hintId} className="mt-1 text-[12px] text-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
