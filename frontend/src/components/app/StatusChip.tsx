const TONE: Record<string, string> = {
  Active: "chip-ok",
  Present: "chip-ok",
  Approved: "chip-ok",
  Paid: "chip-ok",
  Pending: "chip-warn",
  "On Leave": "chip-warn",
  "Half Day": "chip-warn",
  "On Hold": "chip-warn",
  Rejected: "chip-bad",
  Absent: "chip-bad",
  Disabled: "chip-bad",
  Inactive: "",
  Holiday: "",
};

/** A status string from the database rendered as a coloured chip. */
export function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-faint">-</span>;
  return <span className={`chip ${TONE[status] ?? ""}`.trim()}>{status}</span>;
}
