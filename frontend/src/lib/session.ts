import type { UserSessionData } from './auth';

export type Role = 'Admin' | 'HR' | 'Employee';

/**
 * Authentication is intentionally disabled for now: every caller is a fixed
 * local Admin. No cookie, no secret, no redirect. Reintroduce real sessions
 * here later; callers (pages and server actions) already go through these
 * functions, so nothing else needs to change.
 */
const LOCAL_SESSION: UserSessionData = {
  accountId: 0,
  employeeId: 1,
  username: 'local',
  accessRole: 'Admin',
  employeeName: 'Local user',
};

export async function getSession(): Promise<UserSessionData | null> {
  return { ...LOCAL_SESSION };
}

export async function requireSession(): Promise<UserSessionData> {
  return { ...LOCAL_SESSION };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function requireRoles(roles: Role[]): Promise<UserSessionData> {
  return { ...LOCAL_SESSION };
}
