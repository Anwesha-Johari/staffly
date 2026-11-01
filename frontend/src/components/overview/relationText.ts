import type { ForeignKey, SchemaModel } from "@/lib/types";

/** Plain-English sentences derived entirely from ForeignKey fields. Backticks mark code. */

function plural(tableName: string): string {
  const spaced = tableName.replace(/_/g, " ");
  return tableName.endsWith("s") ? spaced : `${spaced} records`;
}

/** "job_roles" -> "job role"; names that do not end in "s" get " record" appended. */
export function noun(tableName: string): string {
  const words = tableName.split("_");
  const last = words.pop() ?? "";
  let s = last;
  if (/ies$/.test(last)) s = last.slice(0, -3) + "y";
  else if (/(ss|us)$/.test(last)) s = last;
  else if (/s$/.test(last)) s = last.slice(0, -1);
  else s = last + " record";
  return [...words, s].join(" ");
}

const article = (w: string) => (/^(?!us|uni|one)[aeiou]/i.test(w) ? "an" : "a");
const A = (w: string) => `${article(w)} ${w}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface RelationReading {
  cardinality: "1:N" | "1:1";
  participation: "Optional" | "Mandatory";
  lines: { label: string; text: string }[];
}

function deleteLine(fk: ForeignKey, parentN: string): string {
  const child = `\`${fk.table}.${fk.columns.join(", ")}\``;
  switch (fk.onDelete) {
    case "CASCADE":
      return `Deleting ${A(parentN)} also deletes every \`${fk.table}\` row that references it (ON DELETE CASCADE).`;
    case "SET NULL":
      return `Deleting ${A(parentN)} sets ${child} to NULL in the rows that referenced it (ON DELETE SET NULL). Those rows are kept.`;
    case "SET DEFAULT":
      return `Deleting ${A(parentN)} would set ${child} to its default (ON DELETE SET DEFAULT), but InnoDB rejects table definitions that use this action.`;
    default:
      return `Deleting ${A(parentN)} is refused while any \`${fk.table}\` row still references it (ON DELETE ${fk.onDelete}).`;
  }
}

function updateLine(fk: ForeignKey, parentN: string): string {
  const parentKey = `\`${fk.refTable}.${fk.refColumns.join(", ")}\``;
  const child = `\`${fk.table}.${fk.columns.join(", ")}\``;
  switch (fk.onUpdate) {
    case "CASCADE":
      return `Changing ${parentKey} is copied into ${child} (ON UPDATE CASCADE), so existing links are not broken.`;
    case "SET NULL":
      return `Changing ${parentKey} sets ${child} to NULL in the rows that referenced the old value (ON UPDATE SET NULL).`;
    case "SET DEFAULT":
      return `Changing ${parentKey} would set ${child} to its default (ON UPDATE SET DEFAULT), but InnoDB rejects table definitions that use this action.`;
    default:
      return `Changing ${parentKey} is refused while any ${A(noun(fk.table))} row references ${A(parentN)} (ON UPDATE ${fk.onUpdate}).`;
  }
}

export function readRelationship(schema: SchemaModel, fk: ForeignKey): RelationReading {
  const childN = noun(fk.table);
  const parentN = noun(fk.refTable);
  const cols = fk.columns.join(", ");
  const lines: RelationReading["lines"] = [];

  if (fk.selfReference) {
    lines.push({
      label: "Reads as",
      text: `${cap(A(childN))} refers to ${fk.optional ? "at most one other" : "exactly one other"} ${parentN} through \`${fk.table}.${cols}\`.`,
    });
    lines.push({
      label: "Reverse",
      text: `${cap(A(parentN))} can be referenced by many other ${plural(fk.table)}, or by none.`,
    });
  } else {
    lines.push({
      label: "Reads as",
      text: `${cap(A(childN))} belongs to ${fk.optional ? "at most one" : "exactly one"} ${parentN}.`,
    });
    lines.push({
      label: "Reverse",
      text: fk.oneToOne
        ? `${cap(A(parentN))} can have at most one ${childN}.`
        : `${cap(A(parentN))} can have many ${plural(fk.table)}, or none.`,
    });
  }

  lines.push({
    label: "Nullability",
    text: fk.optional
      ? `\`${cols}\` accepts NULL, so ${A(childN)} can exist without ${A(parentN)}${fk.selfReference ? " to point at" : ""}.`
      : `\`${cols}\` is NOT NULL, so every ${childN} must name ${A(parentN)}.`,
  });

  if (fk.oneToOne) {
    lines.push({
      label: "Uniqueness",
      text: `\`${cols}\` is also UNIQUE, which caps it at one ${childN} per ${parentN}. That is what makes this 1:1 instead of 1:N.`,
    });
  }

  lines.push({ label: "On delete", text: deleteLine(fk, parentN) });
  lines.push({ label: "On update", text: updateLine(fk, parentN) });

  const child = schema.tables.find((t) => t.name === fk.table);
  const idx = child?.indexes.find((i) => fk.columns.every((c, k) => i.columns[k] === c));
  if (idx) {
    const prefix = idx.columns.length > fk.columns.length ? ", using its leftmost column(s)" : "";
    const how = idx.explicit ? "declared in the DDL" : "created automatically for the constraint";
    lines.push({
      label: "Index",
      text: `InnoDB needs an index on the referencing column so each parent check is an index lookup, not a table scan. Here that is the ${idx.kind === "INDEX" ? "" : idx.kind.toLowerCase() + " "}index \`${idx.name}\`${prefix}, ${how}.`,
    });
  }

  return {
    cardinality: fk.oneToOne ? "1:1" : "1:N",
    participation: fk.optional ? "Optional" : "Mandatory",
    lines,
  };
}
