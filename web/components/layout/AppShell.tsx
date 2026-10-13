"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { TestnetSeal, Wordmark } from "@/components/art/Art";
import { NetworkGuard } from "@/components/wallet/NetworkGuard";
import { shortAddress } from "@/lib/stockback";

const NAV = [
  { href: "/app/dashboard", label: "Dashboard", icon: "M3 11 12 3l9 8v10h-6v-6H9v6H3z" },
  { href: "/app/scan", label: "Scan receipt", icon: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" },
  { href: "/app/portfolio", label: "Portfolio", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/app/activity", label: "Activity", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { href: "/app/brands", label: "Brands", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/how-it-works", label: "How it works", icon: "M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V14M12 18h.01" },
  { href: "/app/settings", label: "Settings", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4" },
];
const MOBILE = NAV.slice(0, 4);

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { address } = useAccount();
  const active = (href: string) => path === href || (href !== "/how-it-works" && path.startsWith(href + "/"));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink/10 px-6 py-8 lg:flex" aria-label="App navigation">
        <Link href="/" aria-label="STOCKBACK home">
          <Wordmark />
        </Link>
        <nav className="mt-14 flex-1">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={`group flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-200 ${
                    active(n.href) ? "bg-ink text-paper" : "text-charcoal hover:bg-paper-dark"
                  }`}
                >
                  <Icon d={n.icon} />
                  {n.label}
                  {active(n.href) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-3 border-t border-ink/10 pt-5 text-xs">
          <p className="font-mono uppercase tracking-[0.2em] text-muted">Wallet</p>
          <p className="font-mono text-sm">{address ? shortAddress(address) : "Not connected"}</p>
          <p className="flex items-center gap-2 text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />
            Robinhood Testnet
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-24 lg:pb-0">
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="lg:hidden" aria-label="STOCKBACK home">
            <Wordmark />
          </Link>
          <span className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <span className="sm:hidden">
              <TestnetSeal compact />
            </span>
            <span className="hidden sm:block">
              <TestnetSeal />
            </span>
          </div>
        </header>
        <main id="main" className="flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <NetworkGuard>{children}</NetworkGuard>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-paper/95 backdrop-blur lg:hidden" aria-label="App navigation">
        <ul className="grid grid-cols-4">
          {MOBILE.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium ${active(n.href) ? "text-vermilion-deep" : "text-charcoal"}`}
              >
                <Icon d={n.icon} />
                {n.label.split(" ")[0]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
