/**
 * Turns a logged SQL statement into plain English for the "Live activity" tab.
 * Pure string analysis, safe to run in the browser.
 */

export interface StatementReading {
  headline: string;
  /** 1-3 short sentences. */
  plain: string[];
  tables: string[];
  /** True for statements the explainer tour itself issues (counts, sample rows, EXPLAIN). */
  fromTour: boolean;
}

const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();

export function tablesIn(sql: string, known: string[]): string[] {
  const found = new Set<string>();
  for (const m of norm(sql).matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+`?([a-z_]+)`?/gi)) {
    if (known.includes(m[1].toLowerCase())) found.add(m[1].toLowerCase());
  }
  return [...found];
}

function isTourStatement(sql: string, concept: string): boolean {
  const s = norm(sql);
  return (
    /^SELECT VERSION\(\)/i.test(s) ||
    /^SELECT COUNT\(\*\) AS n FROM `/i.test(s) ||
    /^SELECT `[a-z_]+`(, `[a-z_]+`)* FROM `[a-z_]+` ORDER BY `[a-z_]+` LIMIT 5$/i.test(s) ||
    /^EXPLAIN /i.test(s) ||
    /^START TRANSACTION READ ONLY$/i.test(s) ||
    /^ROLLBACK$/i.test(s) ||
    /Query library: run with sample values/i.test(concept)
  );
}

export function readStatement(sql: string, operation: string, concept: string, knownTables: string[]): StatementReading {
  const s = norm(sql);
  const tables = tablesIn(s, knownTables);
  const main = tables[0] ?? "a table";
  const fromTour = isTourStatement(s, concept);
  const joined = tables.length > 1;
  const list = tables.join(", ");
  const upper = s.toUpperCase();

  if (/^(START TRANSACTION|BEGIN)/.test(upper)) {
    return {
      headline: "Starts a transaction",
      plain: ["Everything that follows is one unit of work: it all succeeds (COMMIT) or none of it does (ROLLBACK)."],
      tables,
      fromTour,
    };
  }
  if (/^COMMIT/.test(upper)) {
    return { headline: "Commits the transaction", plain: ["The changes become permanent and visible to everyone, and the locks are released."], tables, fromTour };
  }
  if (/^ROLLBACK/.test(upper)) {
    return { headline: "Rolls the transaction back", plain: ["Every change made since the transaction began is undone, as if it never happened."], tables, fromTour };
  }
  if (/^EXPLAIN/.test(upper)) {
    return { headline: "Asks MySQL for its plan", plain: ["EXPLAIN shows how MySQL would run a query, without running it."], tables, fromTour };
  }

  if (operation === "INSERT" || /^INSERT/.test(upper)) {
    const extra = main === "payroll" ? " MySQL calculates net_salary itself from the other amounts." : "";
    return {
      headline: `Adds a new row to ${main}`,
      plain: [
        `A new ${main} row is written. MySQL first checks every rule on the table (NOT NULL, CHECK, UNIQUE, foreign keys); if one fails, nothing is saved.${extra}`,
      ],
      tables,
      fromTour,
    };
  }

  if (operation === "UPDATE" || /^UPDATE/.test(upper)) {
    const guard = /leave_status\s*=\s*'Pending'/i.test(s);
    return {
      headline: guard ? "Decides a leave request, only if it is still pending" : `Changes rows in ${main}`,
      plain: [
        "The matching rows are locked while they change, so nobody else can change them at the same moment.",
        ...(guard ? ["The AND leave_status = 'Pending' guard means a request that someone already decided is left alone (0 rows changed)."] : []),
      ],
      tables,
      fromTour,
    };
  }

  if (operation === "DELETE" || /^DELETE/.test(upper)) {
    return {
      headline: `Deletes rows from ${main}`,
      plain: ["The matching rows are removed. Foreign key rules then decide what happens to rows in other tables that pointed at them."],
      tables,
      fromTour,
    };
  }

  // SELECT
  const grouped = /GROUP BY/.test(upper);
  const counts = /COUNT\(/.test(upper);
  const like = /\bLIKE\b/.test(upper);
  const lowered = /LOWER\(/.test(upper);
  const pointLookup = /WHERE\s+[a-z_.]*(employee_id|account_id|payroll_id|leave_id|department_id)\s*=\s*\?/i.test(s) || /\bWHERE\b[^;]*=\s*\d+\s*$/i.test(s);

  let headline: string;
  if (grouped) headline = `Counts and groups rows from ${list || main}`;
  else if (counts) headline = `Counts rows in ${list || main}`;
  else if (joined) headline = `Reads ${tables[0]} together with ${tables.slice(1).join(", ")}`;
  else headline = `Reads rows from ${main}`;

  const plain: string[] = [];
  if (joined) plain.push(`A JOIN combines rows from ${list} by following their foreign keys, so one result row carries data from several tables.`);
  if (grouped || counts) plain.push("An aggregate (COUNT, SUM and similar) squeezes many rows into a few summary numbers.");
  if (pointLookup && !like) plain.push("Filtering on a key column lets MySQL jump straight to the row through an index.");
  else if (like || lowered) plain.push("A function or a leading wildcard on the column stops MySQL from using an index, so it reads every row and tests each one.");
  else if (/WHERE/.test(upper)) plain.push("The WHERE clause limits the rows; if an index covers it, MySQL reads only those rows.");
  else plain.push("There is no WHERE clause, so MySQL reads the whole table (or index) to answer.");
  plain.push("A plain SELECT uses a snapshot, so it does not lock rows or block other users.");
  return { headline, plain: plain.slice(0, 3), tables, fromTour };
}
