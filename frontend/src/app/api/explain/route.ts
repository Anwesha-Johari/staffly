import { connection } from 'next/server';
import { explainLibraryQuery } from '@/lib/explainable';
import { isSameOrigin, json } from '../_lib/http';

/**
 * POST /api/explain  { id: string }
 * Runs EXPLAIN for a query from the built-in library, looked up by id.
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

  return json(await explainLibraryQuery(id));
}
