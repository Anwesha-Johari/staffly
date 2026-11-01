"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, Database, LayoutDashboard, Users, Wallet } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: "dashboard" | "employees" | "attendance" | "leave" | "payroll" | "hood";
}

const ICONS = {
  dashboard: LayoutDashboard,
  employees: Users,
  attendance: CalendarCheck,
  leave: CalendarDays,
  payroll: Wallet,
  hood: Database,
} as const;

/** Sidebar / mobile nav. Highlights the item matching the current path. */
export function NavLinks({
  items,
  orientation,
}: {
  items: NavItem[];
  orientation: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <ul className={orientation === "vertical" ? "flex flex-col gap-0.5" : "flex items-center gap-1"}>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] transition-colors ${
                active
                  ? "bg-surface-2 font-medium text-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className={active ? "text-accent" : "text-faint"}
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
