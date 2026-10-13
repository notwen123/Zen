import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "App", robots: { index: false } };

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <AppShell>{children}</AppShell>;
}
