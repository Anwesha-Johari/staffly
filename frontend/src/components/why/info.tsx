import type { ReactNode } from "react";
import type { ConstraintKind, StepId } from "@/lib/violations";

/** Short explanations shown in InfoTips. */

export const KIND_INFO: Record<ConstraintKind, ReactNode> = {
  CHECK: (
    <>
      A CHECK is a true/false rule on the row, like <code>salary &gt;= 0</code>. If it is false, MySQL rejects the
      statement.
    </>
  ),
  UNIQUE: (
    <>
      A UNIQUE index allows each key only once. A key made of two columns is unique as a pair.
    </>
  ),
  "FOREIGN KEY": (
    <>
      A foreign key must match a row in the parent table, or be NULL. A child row with no parent is refused.
    </>
  ),
  "NOT NULL": <>A NOT NULL column must always hold a value. Assigning NULL is refused.</>,
  GENERATED: (
    <>
      MySQL computes a generated column from other columns. You can read it, but you cannot write your own value.
    </>
  ),
  "SET NULL": (
    <>
      With ON DELETE SET NULL, deleting a parent row clears the foreign key in its child rows. The delete is allowed.
    </>
  ),
};

export const STEP_INFO: Record<Exclude<StepId, "app">, ReactNode> = {
  column: <>MySQL checks each value against its column: type, NOT NULL, and generated columns.</>,
  constraint: <>CHECK, UNIQUE and FOREIGN KEY rules are tested next. The first one that fails stops the statement.</>,
  result: <>If every step passes, MySQL commits the change. Any error undoes the whole statement.</>,
};
