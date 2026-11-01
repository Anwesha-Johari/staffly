import { Suspense, type ReactNode } from "react";
import { AppShell, ShellSkeleton } from "@/components/app/AppShell";

/**
 * Frame for every dashboard page. The <Suspense> boundary also covers pages below
 * that read request data (required by cacheComponents).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
