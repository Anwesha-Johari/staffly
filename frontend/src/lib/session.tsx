"use client";

// Authentication has been removed: the app always runs as a single Admin user.
// `employeeId` is used for "my own" actions (e.g. requesting leave) and must match
// an existing row in the employees table.
export type Role = "Admin" | "HR" | "Employee";
export interface SessionUser {
  accountId: number;
  employeeId: number;
  username: string;
  accessRole: Role;
  employeeName: string;
}

const USER: SessionUser = { accountId: 0, employeeId: 1, username: "admin", accessRole: "Admin", employeeName: "Admin" };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useSession() {
  return { user: USER as SessionUser | null, ready: true };
}

export const isStaff = (u: SessionUser | null) => u?.accessRole === "Admin" || u?.accessRole === "HR";
