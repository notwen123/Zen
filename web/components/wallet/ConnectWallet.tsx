"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { shortAddress } from "@/lib/stockback";

/** RainbowKit connect, dressed as STOCKBACK. */
export function ConnectWallet({ label = "Connect wallet", className }: { label?: string; className?: string }) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openChainModal, mounted, authenticationStatus }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected = ready && account && chain;
        const cls = `ink-btn inline-flex min-h-10 items-center gap-2.5 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em] ${className ?? ""}`;
        if (!ready) return <span className={`${cls} invisible`} aria-hidden="true">{label}</span>;
        if (!connected)
          return (
            <button type="button" onClick={openConnectModal} className={`${cls} bg-ink text-paper`}>
              {label}
            </button>
          );
        if (chain.unsupported)
          return (
            <button type="button" onClick={openChainModal} className={`${cls} border border-vermilion text-vermilion-deep hover:text-paper`}>
              Switch network
            </button>
          );
        return (
          <Link href="/app/dashboard" className={`${cls} border border-ink/70 text-ink hover:text-paper`} aria-label={`Open STOCKBACK app, connected as ${account.displayName}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />
            <span className="font-mono normal-case tracking-normal">{account.ensName ?? shortAddress(account.address)}</span>
          </Link>
        );
      }}
    </ConnectButton.Custom>
  );
}
