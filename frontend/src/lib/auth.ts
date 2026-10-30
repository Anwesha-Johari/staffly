import bcrypt from 'bcryptjs';

export interface UserSessionData {
  accountId: number;
  employeeId: number;
  username: string;
  accessRole: 'Admin' | 'HR' | 'Employee';
  employeeName: string;
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;
  try {
    return await bcrypt.compare(password, storedHash);
  } catch {
    return false;
  }
}

export function requireRole(session: UserSessionData | null, allowedRoles: Array<'Admin' | 'HR' | 'Employee'>) {
  if (!session) {
    throw new Error('Access denied. Authentication required.');
  }
  if (!allowedRoles.includes(session.accessRole)) {
    throw new Error(`Access denied. Role ${session.accessRole} is not authorized for this action.`);
  }
}
