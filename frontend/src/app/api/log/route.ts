import { connection } from 'next/server';
import { clearQueryLogs, getQueryLogs } from '@/lib/db';
import { isSameOrigin, json } from '../_lib/http';

/** GET /api/log: the last (up to) 100 statements this dashboard has run, newest first. */
export async function GET(): Promise<Response> {
  await connection();
  return json(getQueryLogs());
}

/** DELETE /api/log: empties the in-memory log. Same-origin requests only. */
export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return json({ ok: false, reason: 'cross-origin request refused' }, 403);
  clearQueryLogs();
  return json({ ok: true });
}
