import { connection } from 'next/server';
import { runTxDemo } from '@/lib/txdemo';
import { isSameOrigin, json } from '../_lib/http';

/**
 * POST /api/txdemo  { id: "leave-race" | "deadlock" }
 * Plays a fixed two-session script on a throwaway scratch table.
 * The request carries only an id, never SQL.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();
  if (!isSameOrigin(request)) return json({ ok: false, reason: 'cross-origin request refused' }, 403);
  let id: unknown;
  try {
    const body: unknown = await request.json();
    id = typeof body === 'object' && body !== null ? (body as { id?: unknown }).id : undefined;
  } catch {
    return json({ ok: false, reason: 'Body must be JSON: {"id": "<scenario id>"}' }, 400);
  }
  if (typeof id !== 'string' || id.length > 40) return json({ ok: false, reason: 'Invalid id' }, 400);
  return json(await runTxDemo(id));
}
