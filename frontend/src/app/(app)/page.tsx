import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/PageHeader";
import { DbUnavailable } from "@/components/app/DbUnavailable";
import { AdminHome } from "@/components/app/home/AdminHome";

export const metadata: Metadata = { title: "Dashboard | Staffly" };

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-faint">Loading dashboard...</p>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  let body: React.ReactNode;
  try {
    // Awaited here so that a failing query is caught and replaced by DbUnavailable.
    body = await AdminHome();
  } catch (error) {
    body = <DbUnavailable error={error} />;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your workforce. Every figure comes straight from a SQL query you can inspect."
      />
      {body}
    </>
  );
}
