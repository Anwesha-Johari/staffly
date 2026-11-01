import type { ReactNode } from "react";
import Link from "next/link";
import { NavLinks, type NavItem } from "./NavLinks";

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/employees", label: "Employees", icon: "employees" },
  { href: "/attendance", label: "Attendance", icon: "attendance" },
  { href: "/leave", label: "Leave", icon: "leave" },
  { href: "/payroll", label: "Payroll", icon: "payroll" },
];

const HOOD: NavItem = { href: "/under-the-hood", label: "Under the hood", icon: "hood" };

function Brand() {
  return (
    <Link href="/" className="font-display flex items-center gap-2 text-[18px] font-medium tracking-tight text-ink">
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" />
      Staffly
    </Link>
  );
}

/**
 * The app frame: sidebar (top strip below 900px) and the page content.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const items = NAV;

  return (
    <div className="flex min-h-screen flex-1">
      <aside
        aria-label="Primary"
        className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5 min-[900px]:flex"
      >
        <div className="px-3 pb-6">
          <Brand />
        </div>
        <nav aria-label="Main">
          <NavLinks items={items} orientation="vertical" />
        </nav>
        <div className="mt-auto border-t border-line pt-3">
          <NavLinks items={[HOOD]} orientation="vertical" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line bg-surface min-[900px]:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand />
          </div>
          <nav aria-label="Main" className="overflow-x-auto px-3 pb-2">
            <NavLinks items={[...items, HOOD]} orientation="horizontal" />
          </nav>
        </div>

        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Static placeholder shown while the session is being read. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-1" aria-busy="true">
      <aside className="hidden w-[232px] shrink-0 border-r border-line px-3 py-5 min-[900px]:block">
        <div className="px-3">
          <Brand />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-[53px] border-b border-line" />
        <p className="px-6 py-8 text-[13px] text-faint">Loading...</p>
      </div>
    </div>
  );
}
