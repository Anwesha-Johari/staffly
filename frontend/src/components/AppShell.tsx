"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LayoutDashboard, Users, CalendarCheck, Plane, Wallet, Database, Menu, X, Building2 } from "lucide-react";
import { useSession, type Role } from "@/lib/session";
import { Avatar, cx } from "@/components/ui";

const NAV: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: Role[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "HR", "Employee"] },
  { href: "/employees", label: "Employees", icon: Users, roles: ["Admin", "HR", "Employee"] },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["Admin", "HR", "Employee"] },
  { href: "/leave", label: "Leave", icon: Plane, roles: ["Admin", "HR", "Employee"] },
  { href: "/payroll", label: "Payroll", icon: Wallet, roles: ["Admin", "HR", "Employee"] },
  { href: "/database", label: "Database", icon: Database, roles: ["Admin"] },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-sm">
        <Building2 className="size-4.5" />
      </span>
      Staffly
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Pages read the current date and other browser-only values, so render them client-side only.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.accessRole));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5"><Logo className="text-lg" /></div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Main">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"
              )}
            >
              <Icon className="size-4.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3">
        <Avatar name="Admin" size={36} />
        <div className="min-w-0"><p className="text-sm font-medium">Admin</p><p className="text-xs text-muted">Full access</p></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-muted hover:bg-surface-2 cursor-pointer"><Menu className="size-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="anim-slide-in absolute left-0 top-0 h-full w-72 bg-surface shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-surface-2 cursor-pointer"><X className="size-5" /></button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">{mounted ? children : <div className="skeleton h-40" />}</div>
      </main>
    </div>
  );
}
