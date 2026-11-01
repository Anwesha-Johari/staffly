import type { AccessType, LibraryQuery } from "@/lib/types";

/** Short, student-friendly explanations for every concept label used in the query library. */
export const CONCEPT_INFO: Record<string, string> = {
  "Primary key point lookup":
    "Finding one row by its primary key. InnoDB keeps the table sorted by that key, so it only walks down a small tree.",
  "Unique index":
    "An index that forbids duplicates. It also tells MySQL that a match returns at most one row.",
  "Inner join":
    "Keeps only row pairs that match the join condition. MySQL loops over one table and probes the other, ideally through an index.",
  "Left outer join":
    "Keeps every row of the left table, filling the right side with NULL when nothing matches.",
  "Self join":
    "Joining a table to itself under a second alias, for example employees to their managers.",
  "Sargable predicate":
    "A condition an index can search: the bare column compared with a value, like col = ?.",
  "Non-sargable predicate":
    "A condition that wraps the column in a function, like LOWER(email) = ?. The index cannot be used, so rows are checked one by one.",
  "Covering index":
    "An index that holds every column the query needs, so the table is never read. Secondary indexes always carry the primary key.",
  "Compare-and-set update":
    "An UPDATE that also checks the old value (status = 'Pending'). Only the first writer changes the row, so nothing is lost.",
  "Generated column":
    "A column computed from other columns. A STORED one is saved on write, so it can never disagree with its inputs.",
  Aggregation:
    "Collapsing many rows into one summary value with COUNT, SUM and similar functions.",
  "Full table scan":
    "Reading every row (access type ALL). It is fine for tiny tables or when most rows are needed.",
  "Composite index":
    "An index on several columns, sorted by the first, then the second. It serves conditions on its leftmost columns.",
  "Range scan":
    "Reading only a slice of an index between two bounds. It needs equality on earlier columns and a range on the next.",
  "Leftmost prefix":
    "An index on (a, b) can be searched by a, or by a and b, but not by b alone.",
  Filesort:
    "MySQL's extra sort step when no index gives the requested ORDER BY order. It usually sorts in memory.",
  "Clustered index":
    "In InnoDB the primary key index is the table: its leaves hold the full rows in key order.",
  "Row lock":
    "InnoDB locks the rows an UPDATE touches until commit, so other writers to those rows wait.",
  "Foreign key check":
    "On insert, InnoDB checks that the referenced parent row exists. NULL values are not checked.",
  "CHECK constraint":
    "A rule on a row's values, like salary >= 0, enforced by the database on every write.",
  "Check-then-act race":
    "Checking and then inserting leaves a gap where another request can sneak in. A UNIQUE constraint closes it.",
  "Leading wildcard":
    "A LIKE pattern starting with %, as in '%mar%'. A sorted index cannot jump to a match that may start anywhere.",
  "Case-insensitive collation":
    "The default collation ignores case, so email = ? already matches any capitalisation and LOWER() is not needed.",
  "Half-open interval":
    "A range written as start <= x AND x < next_start. It covers a whole month and keeps the column index-friendly.",
  "Index-ordered output":
    "When an index already stores rows in ORDER BY order, MySQL reads it in sequence and skips the sort.",
};

export function conceptInfo(name: string): string {
  return CONCEPT_INFO[name] ?? "A database idea shown by this statement.";
}

export const CATEGORY_INFO: Record<LibraryQuery["category"], string> = {
  Lookup: "Fetch one row, or answer a yes/no question, by key.",
  Join: "Combine rows from several tables on matching columns.",
  Aggregate: "Collapse many rows into summary values like COUNT and SUM.",
  Insert: "Add new rows. Writes also enforce constraints and update every index.",
  Update: "Change existing rows. The engine finds them first, then locks them until commit.",
  Search: "Find rows from text a user typed. Whether an index helps depends on the pattern.",
  Auth: "Identify an account by a unique credential and return its stored hash.",
};

export const ACCESS_INFO: Record<AccessType, string> = {
  const: "At most one row via a PRIMARY or UNIQUE key. Best case.",
  eq_ref: "One row per outer row through a unique key in a join.",
  ref: "Index lookup that can return several rows.",
  range: "A bounded slice of an index (>, <, BETWEEN, IN).",
  index: "A full scan of an index, not of the table.",
  ALL: "A full table scan. Fine for tiny tables, a red flag for big ones.",
};
