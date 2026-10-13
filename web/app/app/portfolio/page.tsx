"use client";

import { useAccount } from "@/lib/account";
import { useClaims } from "@/components/hooks/useZen";
import { useState } from "react";
import { ClaimCard, ClaimsSummary, claimState, useNow, type ClaimState } from "@/components/claims/LockedEquity";
import type { LockedClaim } from "@/lib/zen";

const FILTERS: { key: "active" | "all" | ClaimState; label: string; match: (s: ClaimState) => boolean }[] = [
  { key: "active", label: "Needs action", match: (s) => s === "locked" },
  { key: "cashed", label: "Cashed out", match: (s) => s === "cashed" },
  { key: "settled", label: "Settled", match: (s) => s === "settled" },
  { key: "voided", label: "Refunded", match: (s) => s === "voided" },
  { key: "all", label: "All", match: () => true },
];

/** Locked claims first, soonest unlock first; then everything else newest first. */
const order = (a: LockedClaim, b: LockedClaim) => {
  const la = claimState(a) === "locked", lb = claimState(b) === "locked";
  if (la !== lb) return la ? -1 : 1;
  return la ? a.unlockAt - b.unlockAt : Number(b.id - a.id);
};
import { Empty, Muted, ScanLink } from "@/components/ownership/Ownership";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { addressUrl } from "@/lib/chain";
import { contracts } from "@/lib/contracts";

export default function Portfolio() {
  const { address } = useAccount();
  const { data, isLoading, isError, refetch } = useClaims(address);
  const now = useNow();
  const [picked, setFilter] = useState<(typeof FILTERS)[number]["key"]>();
  const [limit, setLimit] = useState(6);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, (data ?? []).filter((c) => f.match(claimState(c))).length]));
  const filter = picked ?? (counts.active ? "active" : "all"); // open on what needs action, else everything
  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = [...(data ?? [])].filter((c) => active.match(claimState(c))).sort(order);

  return (
    <div className="mx-auto max-w-6xl">
      <Muted>Portfolio</Muted>
      <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">My locked equity</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Every reward is a conditional claim on tokenized equity. It stays locked through the purchase&apos;s return window, because the purchase can
        still be refunded. Wait for it to unlock and settle, or cash out now to the instant-exit pool at a discount.
      </p>

      <div className="mt-12">
        {!address ? (
          <Empty title="Connect your wallet." body="Your locked equity claims are read from Monad testnet for the connected wallet." cta={<ConnectWallet />} />
        ) : isLoading ? (
          <p className="breathe text-muted" role="status">
            Reading your claims from Monad testnet…
          </p>
        ) : isError ? (
          <Empty
            title="Claims aren't available right now."
            body="The Monad testnet RPC didn't respond. Retrying automatically."
            cta={
              <button type="button" className="ink-link text-sm" onClick={() => refetch()}>
                Try again now
              </button>
            }
          />
        ) : data?.length ? (
          <>
            <div className="border-b border-ink/15 pb-8">
              <ClaimsSummary claims={data} now={now} />
            </div>
            <div role="tablist" aria-label="Filter claims" className="mt-8 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={filter === f.key}
                  onClick={() => (setFilter(f.key), setLimit(6))}
                  className={`border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.14em] transition-colors ${filter === f.key ? "border-ink bg-ink text-paper" : "border-ink/20 text-charcoal hover:border-ink/50"}`}
                >
                  {f.label} <span className="opacity-60">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            {shown.length ? (
              <>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {shown.slice(0, limit).map((c) => (
                    <ClaimCard key={c.id.toString()} c={c} now={now} />
                  ))}
                </div>
                {shown.length > limit && (
                  <button type="button" onClick={() => setLimit((l) => l + 6)} className="mt-6 font-mono text-xs uppercase tracking-[0.16em] text-ink underline decoration-vermilion underline-offset-4">
                    Show more ({shown.length - limit})
                  </button>
                )}
              </>
            ) : (
              <p className="mt-6 text-sm text-muted">
                {filter === "active" ? "Nothing needs action: no locked claims right now." : "No claims in this view."}{" "}
                {filter === "active" && (
                  <button type="button" className="ink-link" onClick={() => setFilter("all")}>
                    See all claims
                  </button>
                )}
              </p>
            )}
          </>
        ) : (
          <Empty title="No locked equity yet." body="Verify a purchase to mint a locked claim on that brand's tokenized equity." cta={<ScanLink />} />
        )}
      </div>

      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-muted">
        Claims are ERC-721 positions on the{" "}
        <a className="ink-link" href={addressUrl(contracts.conditionalClaim)} target="_blank" rel="noreferrer">
          ConditionalClaim contract
        </a>{" "}
        on Monad testnet, read directly from chain. Testnet uses demo return windows of a few minutes; production windows are 14 to 30 days. The
        underlying assets (mNKE, mAAPL, mSBUX) are simulated tokenized-equity demo tokens. They are not securities and are not affiliated with the brands
        shown.
      </p>
    </div>
  );
}
