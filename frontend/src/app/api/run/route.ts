import { connection } from 'next/server';
import { runLibraryQuery } from '@/lib/explainable';
import { isSameOrigin, json } from '../_lib/http';

/**
 * POST /api/run  { id: string }
 * Runs a built-in SELECT with its sample values (read-only, rolled back).
 * The request never carries SQL: only the id is read from the body.
 */
export async function POST(request: Request): Promise<Response> {
  await connection();
  if (!isSameOrigin(request)) return json({ ok: false, reason: 'cross-origin request refused' }, 403);

  let id: unknown;
  try {
    const body: unknown = await request.json();
    id = typeof body === 'object' && body !== null ? (body as { id?: unknown }).id : undefined;
  } catch {
    return json({ ok: false, reason: 'Body must be JSON: {"id": "<query id>"}' }, 400);
  }
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
    return json({ ok: false, reason: 'Body must be JSON: {"id": "<query id>"}' }, 400);
  }
  return json(await runLibraryQuery(id));
}
