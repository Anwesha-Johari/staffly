import mysql, { type Connection } from 'mysql2/promise';

/**
 * Real two-session transaction demos for the "Transactions" tab.
 *
 * Each run opens TWO dedicated connections (not the shared pool) and plays a
 * fixed script against a throwaway table named txdemo_<random>. The table is
 * created and dropped inside the same call, so the real Staffly tables are
 * never read or written. No SQL ever comes from the client.
 */

export interface DemoStep {
  session: 'A' | 'B' | 'system';
  sql: string;
  /** What MySQL actually answered. */
  result: string;
  /** Time this step took, in ms. */
  ms: number;
  kind: 'ok' | 'wait' | 'error';
}

export type DemoResult = { ok: true; steps: DemoStep[]; summary: string } | { ok: false; reason: string };

const LOCK_WAIT_SECONDS = 4;
const WORK_BUDGET_MS = 9000;

function connectOptions() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'employee_management',
    connectTimeout: 2500,
  };
}

const errText = (e: unknown): string => {
  const x = e as { errno?: number; code?: string; sqlMessage?: string; message?: string };
  return `ERROR ${x.errno ?? '?'} (${x.code ?? 'unknown'}): ${x.sqlMessage ?? x.message ?? 'failed'}`;
};

class Recorder {
  steps: DemoStep[] = [];
  async run(session: DemoStep['session'], conn: Connection, sql: string, describe: (r: unknown) => string): Promise<unknown> {
    const t0 = performance.now();
    try {
      const [r] = await conn.query(sql);
      this.steps.push({ session, sql, result: describe(r), ms: Math.round(performance.now() - t0), kind: 'ok' });
      return r;
    } catch (e) {
      this.steps.push({ session, sql, result: errText(e), ms: Math.round(performance.now() - t0), kind: 'error' });
      throw e;
    }
  }
  note(session: DemoStep['session'], sql: string, result: string, ms: number, kind: DemoStep['kind'] = 'ok') {
    this.steps.push({ session, sql, result, ms, kind });
  }
}

const affected = (r: unknown) => {
  const n = (r as { affectedRows?: number }).affectedRows ?? 0;
  return n === 1 ? '1 row changed' : `${n} rows changed`;
};
const done = () => 'OK';

async function leaveRace(rec: Recorder, a: Connection, b: Connection, t: string): Promise<string> {
  await a.query(`CREATE TABLE ${t} (leave_id INT PRIMARY KEY, leave_status VARCHAR(20) NOT NULL, reviewed_by INT NULL) ENGINE=InnoDB`);
  await a.query(`INSERT INTO ${t} VALUES (7, 'Pending', NULL)`);
  rec.note('system', `CREATE TABLE ${t} ...; INSERT leave 7 as 'Pending'`, 'Scratch table ready (dropped at the end).', 0);

  await rec.run('A', a, 'START TRANSACTION', done);
  await rec.run('B', b, 'START TRANSACTION', done);
  await rec.run(
    'A',
    a,
    `UPDATE ${t} SET leave_status = 'Approved', reviewed_by = 1 WHERE leave_id = 7 AND leave_status = 'Pending'`,
    affected,
  );

  // B asks for the same row. It must wait for A's row lock, so do not await it yet.
  const bSql = `UPDATE ${t} SET leave_status = 'Rejected', reviewed_by = 2 WHERE leave_id = 7 AND leave_status = 'Pending'`;
  const bStart = performance.now();
  let bSettled = false;
  const bPending = b.query(bSql).then(
    (r) => {
      bSettled = true;
      return { ok: true as const, r: r[0] };
    },
    (e: unknown) => {
      bSettled = true;
      return { ok: false as const, e };
    },
  );
  await new Promise((r) => setTimeout(r, 700));
  rec.note(
    'B',
    bSql,
    bSettled ? 'Answered immediately (unexpected: no lock wait)' : "Still waiting: A holds the row lock, B cannot continue",
    Math.round(performance.now() - bStart),
    bSettled ? 'ok' : 'wait',
  );

  await rec.run('A', a, 'COMMIT', done);
  const outcome = await bPending;
  if (outcome.ok) {
    rec.note('B', bSql + '  (resumed)', affected(outcome.r), Math.round(performance.now() - bStart), 'ok');
  } else {
    rec.note('B', bSql + '  (resumed)', errText(outcome.e), Math.round(performance.now() - bStart), 'error');
  }
  await rec.run('B', b, 'COMMIT', done);
  const [rows] = await a.query(`SELECT leave_status, reviewed_by FROM ${t} WHERE leave_id = 7`);
  const row = (rows as { leave_status: string; reviewed_by: number }[])[0];
  rec.note('system', `SELECT leave_status, reviewed_by FROM ${t}`, `${row?.leave_status}, reviewed_by ${row?.reviewed_by}`, 0);
  return `B waited for A, then found the request already decided and changed 0 rows. Final status: ${row?.leave_status} (reviewed_by ${row?.reviewed_by}).`;
}

async function deadlock(rec: Recorder, a: Connection, b: Connection, t: string): Promise<string> {
  await a.query(`CREATE TABLE ${t} (id INT PRIMARY KEY, v INT NOT NULL) ENGINE=InnoDB`);
  await a.query(`INSERT INTO ${t} VALUES (1, 0), (2, 0)`);
  rec.note('system', `CREATE TABLE ${t} ...; INSERT rows 1 and 2`, 'Scratch table ready (dropped at the end).', 0);

  await rec.run('A', a, 'START TRANSACTION', done);
  await rec.run('B', b, 'START TRANSACTION', done);
  await rec.run('A', a, `UPDATE ${t} SET v = v + 1 WHERE id = 1`, affected);
  await rec.run('B', b, `UPDATE ${t} SET v = v + 1 WHERE id = 2`, affected);

  const aSql = `UPDATE ${t} SET v = v + 1 WHERE id = 2`;
  const aStart = performance.now();
  let aSettled = false;
  const aPending = a.query(aSql).then(
    (r) => {
      aSettled = true;
      return { ok: true as const, r: r[0] };
    },
    (e: unknown) => {
      aSettled = true;
      return { ok: false as const, e };
    },
  );
  await new Promise((r) => setTimeout(r, 600));
  rec.note('A', aSql, aSettled ? 'Answered already' : 'Waiting: B holds row 2', Math.round(performance.now() - aStart), aSettled ? 'ok' : 'wait');

  // Now B asks for row 1, held by A: a cycle. InnoDB must pick a victim.
  const bSql = `UPDATE ${t} SET v = v + 1 WHERE id = 1`;
  const bStart = performance.now();
  let bOutcome: { ok: true; r: unknown } | { ok: false; e: unknown };
  try {
    const [r] = await b.query(bSql);
    bOutcome = { ok: true, r };
  } catch (e) {
    bOutcome = { ok: false, e };
  }
  rec.note('B', bSql, bOutcome.ok ? affected(bOutcome.r) : errText(bOutcome.e), Math.round(performance.now() - bStart), bOutcome.ok ? 'ok' : 'error');

  const aOutcome = await aPending;
  rec.note(
    'A',
    aSql + '  (resumed)',
    aOutcome.ok ? affected(aOutcome.r) : errText(aOutcome.e),
    Math.round(performance.now() - aStart),
    aOutcome.ok ? 'ok' : 'error',
  );
  const victim = !bOutcome.ok ? 'B' : !aOutcome.ok ? 'A' : null;
  return victim
    ? `InnoDB found the cycle and rolled back session ${victim} (error 1213). The other session carried on. Real applications should retry the victim.`
    : 'No deadlock was reported (unexpected).';
}

const DEMOS = { 'leave-race': leaveRace, deadlock } as const;
export type DemoId = keyof typeof DEMOS;
export const isDemoId = (id: unknown): id is DemoId => typeof id === 'string' && id in DEMOS;

async function sweep(conn: Connection) {
  const [rows] = await conn.query("SELECT table_name AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'txdemo\\_%'");
  for (const r of rows as { n: string }[]) {
    if (/^txdemo_[a-z0-9]+$/.test(r.n)) await conn.query(`DROP TABLE IF EXISTS \`${r.n}\``);
  }
}

async function play(id: DemoId): Promise<DemoResult> {
  const table = `txdemo_${Math.random().toString(36).slice(2, 10)}`;
  const rec = new Recorder();
  let a: Connection | undefined;
  let b: Connection | undefined;
  try {
    a = await mysql.createConnection(connectOptions());
    b = await mysql.createConnection(connectOptions());
    await sweep(a); // remove leftovers from any earlier crashed run
    await b.query(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_SECONDS}`);
    await a.query(`SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_SECONDS}`);
    const summary = await DEMOS[id](rec, a, b, table);
    return { ok: true, steps: rec.steps, summary };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (rec.steps.length === 0 || code === 'ECONNREFUSED') return { ok: false, reason: code === 'ECONNREFUSED' ? 'connection refused' : errText(e) };
    return { ok: true, steps: rec.steps, summary: `The demo stopped early: ${errText(e)}` };
  } finally {
    for (const c of [a, b]) {
      try {
        await c?.query('ROLLBACK');
      } catch {
        /* connection may already be gone */
      }
    }
    try {
      await a?.query(`DROP TABLE IF EXISTS \`${table}\``);
    } catch {
      /* swept on the next run */
    }
    a?.destroy();
    b?.destroy();
  }
}

export async function runTxDemo(id: string): Promise<DemoResult> {
  if (!isDemoId(id)) return { ok: false, reason: 'This scenario cannot be run for real' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DemoResult>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), WORK_BUDGET_MS);
  });
  try {
    return await Promise.race([play(id), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
