"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Role = "Admin" | "HR" | "Employee";
export interface SessionUser {
  accountId: number;
  employeeId: number;
  username: string;
  accessRole: Role;
  employeeName: string;
}

interface Ctx {
  user: SessionUser | null;
  ready: boolean;
  signIn: (u: SessionUser) => void;
  signOut: () => void;
}

const KEY = "staffly.session";
const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  const signIn = useCallback((u: SessionUser) => {
    setUser(u);
    try { sessionStorage.setItem(KEY, JSON.stringify(u)); } catch {}
  }, []);
  const signOut = useCallback(() => {
    setUser(null);
    try { sessionStorage.removeItem(KEY); } catch {}
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut]);
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const c = useContext(SessionCtx);
  if (!c) throw new Error("useSession must be used inside SessionProvider");
  return c;
}

export const isStaff = (u: SessionUser | null) => u?.accessRole === "Admin" || u?.accessRole === "HR";
