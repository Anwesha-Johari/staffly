/**
 * Small helpers shared by the dashboard's route handlers.
 * (The leading underscore keeps this folder out of routing.)
 */

export const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * True when the request clearly comes from this app's own origin.
 * Browsers always send Origin on cross-origin and on same-origin POST/DELETE;
 * a request with neither a matching Origin nor Sec-Fetch-Site: same-origin is refused.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin) {
    try {
      return !!host && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  return site === 'same-origin' || site === 'none';
}

/** Reject after `ms` so a stuck connection can never hang a handler. */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'DASHBOARD_TIMEOUT' })), ms);
  });
  // Swallow a late rejection of the losing promise.
  work.catch(() => undefined);
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Map a driver error to a short, generic reason that never leaks credentials or hosts. */
export function safeReason(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  switch (code) {
    case 'ECONNREFUSED':
      return 'connection refused';
    case 'ER_ACCESS_DENIED_ERROR':
    case 'ER_DBACCESS_DENIED_ERROR':
    case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
      return 'access denied';
    case 'ER_BAD_DB_ERROR':
      return 'unknown database';
    case 'ETIMEDOUT':
    case 'PROTOCOL_SEQUENCE_TIMEOUT':
    case 'DASHBOARD_TIMEOUT':
      return 'timeout';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'host not found';
    case 'ECONNRESET':
    case 'PROTOCOL_CONNECTION_LOST':
      return 'connection lost';
    default:
      return 'unknown error';
  }
}
