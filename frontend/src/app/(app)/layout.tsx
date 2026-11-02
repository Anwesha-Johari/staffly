import { AppShell } from "@/components/AppShell";

// Every page here depends on the client-side session (signed-in user), so there is
// no static shell to validate for instant navigation.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
