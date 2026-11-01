/**
 * Scripted transaction scenarios for the "Transactions" tab.
 *
 * Everything here is a deterministic simulation written from InnoDB's
 * documented behaviour at REPEATABLE READ (the MySQL default). It is NOT a live
 * trace of a running server. Each step carries the full database state after
 * that step ("effects"), so the UI never has to replay or compute anything.
 *
 * Authoring is done with small patches (`set`) that are merged onto the
 * previous state by `build()`, so a step only lists what it changes.
 */

export type SessionId = "A" | "B";
export type Actor = SessionId | "system";
export type TxStateName = "NOT STARTED" | "ACTIVE" | "WAITING" | "COMMITTED" | "ROLLED BACK";

/** committed = current head; uncommitted = head written by an open trx; old = older version reachable through the undo log. */
export type VersionState = "committed" | "uncommitted" | "old";

export interface RowVersion {
  label: string;
  /** Aligned with `Scenario.table.columns`. */
  values: string[];
  state: VersionState;
  /** Transaction id that wrote this version (DB_TRX_ID). */
  writer?: number;
  /** Sessions whose read view resolves to this version. */
  seenBy?: SessionId[];
  note?: string;
}

/** Versions are ordered newest first; versions[0] is the clustered-index record itself. */
export interface RowState {
  versions: RowVersion[];
}

export type LockScope = "table" | "record" | "gap" | "next-key" | "insert-intention";
export type LockMode = "IS" | "IX" | "S" | "X";

export interface LockEntry {
  session: SessionId;
  object: string;
  scope: LockScope;
  mode: LockMode;
  status: "granted" | "waiting";
  implicit?: boolean;
  note?: string;
}

export interface UndoEntry {
  id: string;
  session: SessionId;
  text: string;
  state: "active" | "applied" | "retained" | "freed";
}

export interface RedoEntry {
  lsn: number;
  session: Actor;
  text: string;
  /** True once the log has been fsync'd past this record. */
  flushed: boolean;
}

export interface DirtyPage {
  page: string;
  state: "dirty" | "clean";
  /** LSN of the first change since the page was last written (oldest_modification). */
  oldestLsn: number;
}

export interface TxView {
  state: TxStateName;
  /** Assigned on the first write; null while the transaction is read-only so far. */
  trxId: number | null;
  note?: string;
}

export interface WaitEdge {
  /** `from` is waiting for a lock that `to` holds. */
  from: SessionId;
  to: SessionId;
  on: string;
}

export interface StepState {
  rows: RowState[];
  locks: LockEntry[];
  undo: UndoEntry[];
  redo: RedoEntry[];
  pages: DirtyPage[];
  checkpoint: number;
  tx: Record<SessionId, TxView>;
  waitFor: WaitEdge[];
}

export interface StepResult {
  session: Actor;
  kind: "ok" | "empty" | "blocked" | "error" | "info";
  text: string;
}

export interface Step {
  n: number;
  session: Actor;
  title: string;
  sql?: string;
  narration: string;
  /** Optional extra explanation, shown in an info popover. */
  note?: string;
  result?: StepResult;
  /** True when the wait-for edges form a cycle (deadlock detected). */
  deadlock?: boolean;
  effects: StepState;
  lsn: LsnCounters;
}

export interface LsnCounters {
  current: number;
  flushed: number;
  checkpoint: number;
}

export interface Scenario {
  id: string;
  title: string;
  sessions: SessionId[];
  table: { name: string; columns: string[] };
  showWaitGraph: boolean;
  initial: StepState;
  initialLsn: LsnCounters;
  steps: Step[];
}

/* ---------------------------------------------------------------- helpers */

type Patch = Partial<Omit<StepState, "tx">> & { tx?: Partial<Record<SessionId, TxView>> };

interface StepSpec {
  session: Actor;
  title: string;
  sql?: string;
  narration: string;
  note?: string;
  result?: StepResult;
  deadlock?: boolean;
  set?: Patch;
}

interface ScenarioSpec extends Omit<Scenario, "steps" | "initialLsn"> {
  steps: StepSpec[];
}

const tx = (state: TxStateName, trxId: number | null = null, note?: string): TxView => ({ state, trxId, note });

const ver = (
  label: string,
  values: string[],
  state: VersionState,
  opts: { writer?: number; seenBy?: SessionId[]; note?: string } = {},
): RowVersion => ({ label, values, state, ...opts });

const row = (...versions: RowVersion[]): RowState => ({ versions });

const lock = (
  session: SessionId,
  object: string,
  scope: LockScope,
  mode: LockMode,
  status: "granted" | "waiting" = "granted",
  extra: { implicit?: boolean; note?: string } = {},
): LockEntry => ({ session, object, scope, mode, status, ...extra });

const redo = (lsn: number, session: Actor, text: string, flushed = false): RedoEntry => ({
  lsn,
  session,
  text,
  flushed,
});

const undo = (id: string, session: SessionId, text: string, state: UndoEntry["state"] = "active"): UndoEntry => ({
  id,
  session,
  text,
  state,
});

const page = (name: string, oldestLsn: number, state: DirtyPage["state"] = "dirty"): DirtyPage => ({
  page: name,
  state,
  oldestLsn,
});

const idle = (): Record<SessionId, TxView> => ({ A: tx("NOT STARTED"), B: tx("NOT STARTED") });

function lsnOf(s: StepState): LsnCounters {
  const current = s.redo.reduce((m, e) => Math.max(m, e.lsn), s.checkpoint);
  const flushed = s.redo.reduce((m, e) => (e.flushed ? Math.max(m, e.lsn) : m), s.checkpoint);
  return { current, flushed, checkpoint: s.checkpoint };
}

function build(spec: ScenarioSpec): Scenario {
  let prev = spec.initial;
  const steps: Step[] = spec.steps.map((s, i) => {
    const { tx: txPatch, ...rest } = s.set ?? {};
    const next: StepState = {
      ...prev,
      ...rest,
      tx: { ...prev.tx, ...txPatch },
    };
    prev = next;
    return {
      n: i + 1,
      session: s.session,
      title: s.title,
      sql: s.sql,
      narration: s.narration,
      note: s.note,
      result: s.result,
      deadlock: s.deadlock,
      effects: next,
      lsn: lsnOf(next),
    };
  });
  return { ...spec, steps, initialLsn: lsnOf(spec.initial) };
}

/* -------------------------------------------------------------- scenarios */

/* 1. Atomic commit: add_employee ----------------------------------------- */

const EMP_COLS = ["employee_id", "first_name", "email", "salary"];
const emp1 = row(ver("v1", ["1", "Asha", "asha@staffly.io", "52000.00"], "committed", { writer: 4790 }));
const emp2 = row(ver("v1", ["2", "Ravi", "ravi@staffly.io", "48000.00"], "committed", { writer: 4790 }));

const addEmployee = build({
  id: "atomic-commit",
  title: "Commit",
  sessions: ["A"],
  table: { name: "employees", columns: EMP_COLS },
  showWaitGraph: false,
  initial: {
    rows: [emp1, emp2],
    locks: [],
    undo: [],
    redo: [],
    pages: [],
    checkpoint: 24718300,
    tx: idle(),
    waitFor: [],
  },
  steps: [
    {
      session: "A",
      title: "Check the email is free",
      sql: "SELECT employee_id FROM employees\nWHERE email = 'meera@staffly.io'",
      narration: "The first statement opens the transaction. It only reads, so nothing is locked or logged.",
      result: { session: "A", kind: "empty", text: "Empty set (0 rows)" },
      set: { tx: { A: tx("ACTIVE", null, "read-only so far") } },
    },
    {
      session: "A",
      title: "Insert the employee",
      sql: "INSERT INTO employees\n  (first_name, last_name, email, hire_date, salary)\nVALUES ('Meera', 'Iyer', 'meera@staffly.io',\n        '2025-06-02', 45000.00)",
      narration: "InnoDB writes the row and an undo record. Other sessions cannot see the row yet.",
      note: "Redo records for the change sit in the log buffer until COMMIT flushes them. The new row is locked implicitly by its own transaction id.",
      result: { session: "A", kind: "ok", text: "Query OK, 1 row affected" },
      set: {
        tx: { A: tx("ACTIVE", 4821) },
        rows: [
          emp1,
          emp2,
          row(ver("v1", ["3", "Meera", "meera@staffly.io", "45000.00"], "uncommitted", { writer: 4821 })),
        ],
        locks: [
          lock("A", "employees", "table", "IX"),
          lock("A", "employees.PRIMARY employee_id=3", "record", "X", "granted", { implicit: true }),
          lock("A", "employees.uq_employee_email 'meera@staffly.io'", "record", "X", "granted", { implicit: true }),
        ],
        undo: [undo("U1", "A", "insert undo: employees PK 3 (to roll back: remove this record)")],
        redo: [
          redo(24718352, "A", "undo page: write insert-undo record U1"),
          redo(24718431, "A", "employees.ibd:12 insert clustered record employee_id=3"),
          redo(24718502, "A", "uq_employee_email:14 insert entry ('meera@staffly.io', 3)"),
        ],
        pages: [
          page("undo_001:3", 24718352),
          page("employees.ibd:12", 24718431),
          page("uq_employee_email:14", 24718502),
        ],
      },
    },
    {
      session: "A",
      title: "COMMIT",
      sql: "COMMIT   -- connection.commit()",
      narration: "COMMIT flushes the redo log to disk, so the row is durable and visible to everyone.",
      note: "Data pages stay dirty in memory and are written later. If the server crashes, InnoDB rebuilds them from the redo log.",
      result: { session: "A", kind: "ok", text: "COMMIT OK. Employee 3 is now visible to everyone." },
      set: {
        tx: { A: tx("COMMITTED", 4821) },
        rows: [
          emp1,
          emp2,
          row(ver("v1", ["3", "Meera", "meera@staffly.io", "45000.00"], "committed", { writer: 4821 })),
        ],
        locks: [],
        undo: [undo("U1", "A", "insert undo: employees PK 3", "freed")],
        redo: [
          redo(24718352, "A", "undo page: write insert-undo record U1", true),
          redo(24718431, "A", "employees.ibd:12 insert clustered record employee_id=3", true),
          redo(24718502, "A", "uq_employee_email:14 insert entry ('meera@staffly.io', 3)", true),
          redo(24718566, "A", "COMMIT: mark trx 4821 committed in its undo header", true),
        ],
      },
    },
  ],
});

/* 2. Rollback on constraint violation ------------------------------------- */

const PAY_COLS = ["payroll_id", "employee_id", "pay_month", "net_salary"];
const pay1 = row(ver("v1", ["1", "1", "2025-05-01", "4600.00"], "committed", { writer: 4802 }));
const pay2Unc = row(ver("v1", ["2", "1", "2025-06-01", "4600.00"], "uncommitted", { writer: 4821 }));

const payrollRollback = build({
  id: "rollback",
  title: "Rollback on error",
  sessions: ["A"],
  table: { name: "payroll", columns: PAY_COLS },
  showWaitGraph: false,
  initial: {
    rows: [pay1],
    locks: [],
    undo: [],
    redo: [],
    pages: [],
    checkpoint: 24724000,
    tx: idle(),
    waitFor: [],
  },
  steps: [
    {
      session: "A",
      title: "Insert payroll for employee 1",
      sql: "INSERT INTO payroll\n  (employee_id, pay_month, basic_salary,\n   allowances, deductions)\nVALUES (1, '2025-06-01', 4500.00, 300.00, 200.00)",
      narration: "The row passes every check and is inserted, with an undo record that can reverse it.",
      result: { session: "A", kind: "ok", text: "Query OK, 1 row affected" },
      set: {
        tx: { A: tx("ACTIVE", 4821) },
        rows: [pay1, pay2Unc],
        locks: [
          lock("A", "payroll", "table", "IX"),
          lock("A", "employees", "table", "IS", "granted", { note: "parent of fk_payroll_employee" }),
          lock("A", "employees.PRIMARY employee_id=1", "record", "S", "granted", { note: "foreign key check" }),
          lock("A", "payroll.PRIMARY payroll_id=2", "record", "X", "granted", { implicit: true }),
          lock("A", "payroll.uq_employee_pay_month (1, 2025-06-01)", "record", "X", "granted", { implicit: true }),
        ],
        undo: [undo("U1", "A", "insert undo: payroll PK 2 (to roll back: remove this record)")],
        redo: [
          redo(24724044, "A", "undo page: write insert-undo record U1"),
          redo(24724120, "A", "payroll.ibd:4 insert clustered record payroll_id=2"),
          redo(24724197, "A", "uq_employee_pay_month:7 insert entry (1, 2025-06-01, 2)"),
        ],
        pages: [
          page("undo_001:3", 24724044),
          page("payroll.ibd:4", 24724120),
          page("uq_employee_pay_month:7", 24724197),
        ],
      },
    },
    {
      session: "A",
      title: "Insert payroll for employee 2: CHECK fails",
      sql: "INSERT INTO payroll\n  (employee_id, pay_month, basic_salary,\n   allowances, deductions)\nVALUES (2, '2025-06-01', 4000.00, 0.00, 4500.00)",
      narration: "The CHECK constraint fails, so only this statement errors. The first row is still pending.",
      note: "MySQL checks CHECK constraints before the row reaches InnoDB, so the failed statement writes nothing. The transaction stays open.",
      result: {
        session: "A",
        kind: "error",
        text: "ERROR 3819 (HY000): Check constraint 'chk_payroll_amounts' is violated.",
      },
    },
    {
      session: "A",
      title: "ROLLBACK",
      sql: "ROLLBACK   -- connection.rollback() in the except branch",
      narration: "ROLLBACK replays the undo records backwards, so the first row disappears too.",
      note: "The id used by the removed row is never reused: AUTO_INCREMENT does not go back on rollback.",
      result: { session: "A", kind: "ok", text: "ROLLBACK OK. Payroll row 2 no longer exists." },
      set: {
        tx: { A: tx("ROLLED BACK", 4821) },
        rows: [pay1],
        locks: [],
        undo: [undo("U1", "A", "insert undo: payroll PK 2", "applied")],
        redo: [
          redo(24724044, "A", "undo page: write insert-undo record U1"),
          redo(24724120, "A", "payroll.ibd:4 insert clustered record payroll_id=2"),
          redo(24724197, "A", "uq_employee_pay_month:7 insert entry (1, 2025-06-01, 2)"),
          redo(24724268, "A", "undo applied: payroll.ibd:4 remove record payroll_id=2"),
          redo(24724331, "A", "undo applied: uq_employee_pay_month:7 remove entry (1, 2025-06-01, 2)"),
          redo(24724380, "A", "undo header: trx 4821 finished (rolled back)"),
        ],
      },
    },
  ],
});

/* 3. Two HR users approve the same leave ---------------------------------- */

const LEAVE_COLS = ["leave_id", "employee_id", "leave_status", "reviewed_by"];
const leaveV1 = ver("v1", ["7", "4", "Pending", "NULL"], "committed", { writer: 4780 });
const leaveV1Old = ver("v1", ["7", "4", "Pending", "NULL"], "old", { writer: 4780 });

const leaveRace = build({
  id: "leave-race",
  title: "Two users approve the same leave",
  sessions: ["A", "B"],
  table: { name: "leave_requests", columns: LEAVE_COLS },
  showWaitGraph: true,
  initial: {
    rows: [row(leaveV1)],
    locks: [],
    undo: [],
    redo: [],
    pages: [],
    checkpoint: 24731000,
    tx: idle(),
    waitFor: [],
  },
  steps: [
    {
      session: "A",
      title: "A approves",
      sql: "UPDATE leave_requests\nSET leave_status = 'Approved', reviewed_by = 2,\n    reviewed_at = CURRENT_TIMESTAMP\nWHERE leave_id = 7 AND leave_status = 'Pending'",
      narration: "A locks leave 7 and changes it. The change is not committed yet.",
      result: { session: "A", kind: "ok", text: "Query OK, 1 row affected (Rows matched: 1  Changed: 1)" },
      set: {
        tx: { A: tx("ACTIVE", 4821) },
        rows: [
          row(
            ver("v2", ["7", "4", "Approved", "2"], "uncommitted", { writer: 4821 }),
            leaveV1Old,
          ),
        ],
        locks: [
          lock("A", "leave_requests", "table", "IX"),
          lock("A", "leave_requests.PRIMARY leave_id=7", "record", "X"),
          lock("A", "employees", "table", "IS", "granted", { note: "parent of fk_leave_reviewer" }),
          lock("A", "employees.PRIMARY employee_id=2", "record", "S", "granted", { note: "foreign key check" }),
        ],
        undo: [undo("U1", "A", "update undo: leave_requests PK 7, old (Pending, NULL, NULL)")],
        redo: [
          redo(24731040, "A", "undo page: write update-undo record U1"),
          redo(24731119, "A", "leave_requests.ibd:6 update record leave_id=7"),
          redo(24731188, "A", "fk_leave_reviewer:9 delete-mark (NULL, 7), insert (2, 7)"),
        ],
        pages: [
          page("undo_001:3", 24731040),
          page("leave_requests.ibd:6", 24731119),
          page("fk_leave_reviewer:9", 24731188),
        ],
      },
    },
    {
      session: "B",
      title: "B rejects: blocks",
      sql: "UPDATE leave_requests\nSET leave_status = 'Rejected', reviewed_by = 3,\n    reviewed_at = CURRENT_TIMESTAMP\nWHERE leave_id = 7 AND leave_status = 'Pending'",
      narration: "B needs the same row lock, so it waits instead of overwriting A's uncommitted change.",
      note: "This is a lock wait, not a deadlock. After innodb_lock_wait_timeout (50 s by default) B would get error 1205.",
      result: {
        session: "B",
        kind: "blocked",
        text: "(client blocked) waiting for an X lock held by trx 4821",
      },
      set: {
        tx: { B: tx("WAITING", 4822) },
        locks: [
          lock("A", "leave_requests", "table", "IX"),
          lock("A", "leave_requests.PRIMARY leave_id=7", "record", "X"),
          lock("A", "employees", "table", "IS", "granted", { note: "parent of fk_leave_reviewer" }),
          lock("A", "employees.PRIMARY employee_id=2", "record", "S", "granted", { note: "foreign key check" }),
          lock("B", "leave_requests", "table", "IX"),
          lock("B", "leave_requests.PRIMARY leave_id=7", "record", "X", "waiting"),
        ],
        waitFor: [{ from: "B", to: "A", on: "X lock on leave_requests.PRIMARY leave_id=7" }],
      },
    },
    {
      session: "A",
      title: "A commits",
      sql: "COMMIT   -- connection.commit()",
      narration: "A commits and releases the lock, so B's waiting statement can continue.",
      result: { session: "A", kind: "ok", text: "COMMIT OK. review_leave_request returns True (rowcount 1)." },
      set: {
        tx: { A: tx("COMMITTED", 4821), B: tx("ACTIVE", 4822, "lock granted, statement resuming") },
        rows: [
          row(
            ver("v2", ["7", "4", "Approved", "2"], "committed", { writer: 4821 }),
            leaveV1Old,
          ),
        ],
        locks: [
          lock("B", "leave_requests", "table", "IX"),
          lock("B", "leave_requests.PRIMARY leave_id=7", "record", "X"),
        ],
        undo: [undo("U1", "A", "update undo: leave_requests PK 7, old (Pending, NULL, NULL)", "retained")],
        redo: [
          redo(24731040, "A", "undo page: write update-undo record U1", true),
          redo(24731119, "A", "leave_requests.ibd:6 update record leave_id=7", true),
          redo(24731188, "A", "fk_leave_reviewer:9 delete-mark (NULL, 7), insert (2, 7)", true),
          redo(24731244, "A", "COMMIT: mark trx 4821 committed in its undo header", true),
        ],
        waitFor: [],
      },
    },
    {
      session: "B",
      title: "B resumes: 0 rows changed",
      narration: "B re-checks the row, sees it is already Approved, and changes nothing.",
      note: "After the wait, the WHERE clause is checked against the committed row. This makes the UPDATE a compare-and-set.",
      result: { session: "B", kind: "ok", text: "Query OK, 0 rows affected (Rows matched: 0  Changed: 0)" },
      set: { tx: { B: tx("ACTIVE", 4822) } },
    },
    {
      session: "B",
      title: "B commits",
      sql: "COMMIT   -- connection.commit()",
      narration: "B commits an empty transaction. The WHERE guard stopped Rejected from overwriting Approved.",
      result: { session: "B", kind: "ok", text: "COMMIT OK. review_leave_request returns False (rowcount 0)." },
      set: {
        tx: { B: tx("COMMITTED", 4822) },
        locks: [],
      },
    },
  ],
});

/* 6. Deadlock -------------------------------------------------------------- */

const STATUS_COLS = ["employee_id", "first_name", "employment_status"];
const e1 = (state: VersionState, status: string, writer?: number) =>
  ver(status === "Active" ? "v1" : "v2", ["1", "Asha", status], state, { writer });
const e2 = (state: VersionState, status: string, writer?: number) =>
  ver(status === "Active" ? "v1" : "v2", ["2", "Ravi", status], state, { writer });
const e1Orig = ver("v1", ["1", "Asha", "Active"], "old", { writer: 4790 });
const e2Orig = ver("v1", ["2", "Ravi", "Active"], "old", { writer: 4790 });

const A_X1 = lock("A", "employees.PRIMARY employee_id=1", "record", "X");
const B_X2 = lock("B", "employees.PRIMARY employee_id=2", "record", "X");

const deadlock = build({
  id: "deadlock",
  title: "Deadlock",
  sessions: ["A", "B"],
  table: { name: "employees", columns: STATUS_COLS },
  showWaitGraph: true,
  initial: {
    rows: [
      row(ver("v1", ["1", "Asha", "Active"], "committed", { writer: 4790 })),
      row(ver("v1", ["2", "Ravi", "Active"], "committed", { writer: 4790 })),
    ],
    locks: [],
    undo: [],
    redo: [],
    pages: [],
    checkpoint: 24760000,
    tx: idle(),
    waitFor: [],
  },
  steps: [
    {
      session: "A",
      title: "A updates employee 1",
      sql: "UPDATE employees\nSET employment_status = 'On Leave'\nWHERE employee_id = 1",
      narration: "A locks employee 1 for update. There is no conflict yet.",
      result: { session: "A", kind: "ok", text: "Query OK, 1 row affected" },
      set: {
        tx: { A: tx("ACTIVE", 4821) },
        rows: [
          row(e1("uncommitted", "On Leave", 4821), e1Orig),
          row(ver("v1", ["2", "Ravi", "Active"], "committed", { writer: 4790 })),
        ],
        locks: [lock("A", "employees", "table", "IX"), A_X1],
        undo: [undo("U1", "A", "update undo: employees PK 1, old status 'Active'")],
        redo: [
          redo(24760031, "A", "undo page: write update-undo record U1"),
          redo(24760108, "A", "employees.ibd:12 update record employee_id=1 (status)"),
        ],
        pages: [page("undo_001:3", 24760031), page("employees.ibd:12", 24760108)],
      },
    },
    {
      session: "B",
      title: "B updates employee 2",
      sql: "UPDATE employees\nSET employment_status = 'On Leave'\nWHERE employee_id = 2",
      narration: "B locks employee 2, a different row, so there is still no conflict.",
      result: { session: "B", kind: "ok", text: "Query OK, 1 row affected" },
      set: {
        tx: { B: tx("ACTIVE", 4822) },
        rows: [
          row(e1("uncommitted", "On Leave", 4821), e1Orig),
          row(e2("uncommitted", "On Leave", 4822), e2Orig),
        ],
        locks: [lock("A", "employees", "table", "IX"), A_X1, lock("B", "employees", "table", "IX"), B_X2],
        undo: [
          undo("U1", "A", "update undo: employees PK 1, old status 'Active'"),
          undo("U2", "B", "update undo: employees PK 2, old status 'Active'"),
        ],
        redo: [
          redo(24760031, "A", "undo page: write update-undo record U1"),
          redo(24760108, "A", "employees.ibd:12 update record employee_id=1 (status)"),
          redo(24760180, "B", "undo page: write update-undo record U2"),
          redo(24760257, "B", "employees.ibd:12 update record employee_id=2 (status)"),
        ],
      },
    },
    {
      session: "A",
      title: "A updates employee 2: blocks",
      sql: "UPDATE employees\nSET employment_status = 'On Leave'\nWHERE employee_id = 2",
      narration: "A needs employee 2, which B holds, so A waits.",
      result: { session: "A", kind: "blocked", text: "(client blocked) waiting for an X lock held by trx 4822" },
      set: {
        tx: { A: tx("WAITING", 4821) },
        locks: [
          lock("A", "employees", "table", "IX"),
          A_X1,
          lock("A", "employees.PRIMARY employee_id=2", "record", "X", "waiting"),
          lock("B", "employees", "table", "IX"),
          B_X2,
        ],
        waitFor: [{ from: "A", to: "B", on: "X lock on employees.PRIMARY employee_id=2" }],
      },
    },
    {
      session: "B",
      title: "B updates employee 1: cycle",
      sql: "UPDATE employees\nSET employment_status = 'On Leave'\nWHERE employee_id = 1",
      narration: "B needs employee 1, held by A: a cycle, so InnoDB picks a victim and rolls it back.",
      note: "InnoDB usually rolls back the transaction that changed fewer rows. Here the weights tie, so a real run could pick either session.",
      result: {
        session: "B",
        kind: "error",
        text: "ERROR 1213 (40001): Deadlock found when trying to get lock; try restarting transaction",
      },
      deadlock: true,
      set: {
        locks: [
          lock("A", "employees", "table", "IX"),
          A_X1,
          lock("A", "employees.PRIMARY employee_id=2", "record", "X", "waiting"),
          lock("B", "employees", "table", "IX"),
          B_X2,
          lock("B", "employees.PRIMARY employee_id=1", "record", "X", "waiting"),
        ],
        waitFor: [
          { from: "A", to: "B", on: "X lock on employees.PRIMARY employee_id=2" },
          { from: "B", to: "A", on: "X lock on employees.PRIMARY employee_id=1" },
        ],
        tx: { B: tx("WAITING", 4822, "chosen as deadlock victim") },
      },
    },
    {
      session: "system",
      title: "Victim rolled back, A proceeds",
      narration: "The victim's changes are undone and its locks freed, so A's waiting update completes.",
      note: "The whole victim transaction is rolled back, not only its statement. The client sees error 1213.",
      result: { session: "system", kind: "info", text: "Trx 4822 rolled back. A's UPDATE of employee 2 completes." },
      set: {
        tx: { A: tx("ACTIVE", 4821), B: tx("ROLLED BACK", 4822, "was the deadlock victim") },
        rows: [
          row(e1("uncommitted", "On Leave", 4821), e1Orig),
          row(e2("uncommitted", "On Leave", 4821), e2Orig),
        ],
        locks: [
          lock("A", "employees", "table", "IX"),
          A_X1,
          lock("A", "employees.PRIMARY employee_id=2", "record", "X"),
        ],
        undo: [
          undo("U1", "A", "update undo: employees PK 1, old status 'Active'"),
          undo("U2", "B", "update undo: employees PK 2, old status 'Active'", "applied"),
          undo("U3", "A", "update undo: employees PK 2, old status 'Active'"),
        ],
        redo: [
          redo(24760031, "A", "undo page: write update-undo record U1"),
          redo(24760108, "A", "employees.ibd:12 update record employee_id=1 (status)"),
          redo(24760180, "B", "undo page: write update-undo record U2"),
          redo(24760257, "B", "employees.ibd:12 update record employee_id=2 (status)"),
          redo(24760330, "B", "undo applied: employees.ibd:12 restore employee_id=2 (status)"),
          redo(24760379, "A", "undo page: write update-undo record U3"),
          redo(24760456, "A", "employees.ibd:12 update record employee_id=2 (status)"),
        ],
        waitFor: [],
      },
    },
    {
      session: "A",
      title: "A commits",
      sql: "COMMIT   -- connection.commit()",
      narration: "A commits both changes. The victim should retry; a fixed lock order prevents deadlocks.",
      result: { session: "A", kind: "ok", text: "COMMIT OK. Employees 1 and 2 are On Leave." },
      set: {
        tx: { A: tx("COMMITTED", 4821) },
        rows: [
          row(e1("committed", "On Leave", 4821), e1Orig),
          row(e2("committed", "On Leave", 4821), e2Orig),
        ],
        locks: [],
        undo: [
          undo("U1", "A", "update undo: employees PK 1, old status 'Active'", "retained"),
          undo("U2", "B", "update undo: employees PK 2, old status 'Active'", "applied"),
          undo("U3", "A", "update undo: employees PK 2, old status 'Active'", "retained"),
        ],
        redo: [
          redo(24760031, "A", "undo page: write update-undo record U1", true),
          redo(24760108, "A", "employees.ibd:12 update record employee_id=1 (status)", true),
          redo(24760180, "B", "undo page: write update-undo record U2", true),
          redo(24760257, "B", "employees.ibd:12 update record employee_id=2 (status)", true),
          redo(24760330, "B", "undo applied: employees.ibd:12 restore employee_id=2 (status)", true),
          redo(24760379, "A", "undo page: write update-undo record U3", true),
          redo(24760456, "A", "employees.ibd:12 update record employee_id=2 (status)", true),
          redo(24760510, "A", "COMMIT: mark trx 4821 committed in its undo header", true),
        ],
      },
    },
  ],
});

export const SCENARIOS: Scenario[] = [
  addEmployee,
  payrollRollback,
  leaveRace,
  deadlock,
];
