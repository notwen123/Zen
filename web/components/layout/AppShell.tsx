"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAccount } from "@/lib/account";
import { FundAccount } from "@/components/wallet/FundAccount";
import { TestnetSeal, Wordmark } from "@/components/art/Art";
import { NetworkGuard } from "@/components/wallet/NetworkGuard";
import { shortAddress } from "@/lib/zen";

type Item = { href: string; label: string; icon: string };
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "You",
    items: [
      { href: "/app/dashboard", label: "Home", icon: "M3 11 12 3l9 8v10h-6v-6H9v6H3z" },
      { href: "/app/scan", label: "Scan a receipt", icon: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10" },
      { href: "/app/portfolio", label: "My claims", icon: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z" },
      { href: "/app/locker", label: "Receipt locker", icon: "M4 7h16v13H4zM4 7l2-3h12l2 3M10 11h4" },
    ],
  },
  {
    title: "Market",
    items: [
      { href: "/app/lp", label: "Liquidity pools", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
      { href: "/app/activity", label: "Activity", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
    ],
  },
];
const HELP: Item[] = [
  { href: "/how-it-works", label: "How it works", icon: "" },
  { href: "/app/brands", label: "Brands", icon: "" },
  { href: "/app/settings", label: "Settings", icon: "" },
];
const MOBILE = [GROUPS[0].items[0], GROUPS[0].items[1], GROUPS[0].items[2], GROUPS[1].items[0]];

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
        <Link href="/" aria-label="Zen home">
          <Wordmark />
        </Link>
        <nav className="mt-12 flex-1 space-y-7">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="px-3 text-xs text-muted">{g.title}</p>
              <ul className="mt-2 space-y-0.5">
                {g.items.map((n) => (
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
            </div>
          ))}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-3 text-xs text-muted">
            {HELP.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className={`hover:text-ink ${active(n.href) ? "text-ink underline decoration-vermilion underline-offset-4" : ""}`}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-2 border-t border-ink/10 pt-5 text-xs">
          {address ? (
            <>
              <p className="flex items-center gap-2 text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />
                Signed in with passkey · Monad testnet
              </p>
              <p className="font-mono text-sm">{shortAddress(address)}</p>
              <FundAccount compact />
            </>
          ) : (
            <p className="text-muted">Not signed in. Your account is created from a passkey: no wallet app or seed phrase.</p>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col pb-24 lg:pb-0">
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="lg:hidden" aria-label="Zen home">
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
                {n.label.replace("Scan a receipt", "Scan").replace("Liquidity pools", "Pools")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
