import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staffly, under the hood",
  description: "A simple, visual explanation of how the database behind Staffly works.",
};

export default function UnderTheHoodLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
