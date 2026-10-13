"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/art/Art";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/#ownership", label: "Ownership" },
  { href: "/supported-brands", label: "Brands" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 sm:px-8" aria-label="Main">
        <Link href="/" aria-label="STOCKBACK home" className="shrink-0">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-9 text-[0.82rem] font-medium md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="ink-link py-1" aria-current={path === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block">
            <ConnectWallet />
          </span>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span className={`absolute left-0 top-0 h-px w-5 bg-ink transition-transform duration-300 ${open ? "translate-y-1.5 rotate-45" : ""}`} />
              <span className={`absolute bottom-0 left-0 h-px w-5 bg-ink transition-transform duration-300 ${open ? "-translate-y-1.5 -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-menu" className="border-t border-ink/10 bg-paper px-5 pb-8 pt-4 md:hidden">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="block border-b border-ink/10 py-4 font-display text-2xl">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ConnectWallet className="mt-6 w-full justify-center" />
        </div>
      )}
    </header>
  );
}
