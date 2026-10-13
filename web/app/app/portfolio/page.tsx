"use client";

import { useAccount } from "wagmi";
import { useClaims } from "@/components/hooks/useZen";
import { ClaimCard, ClaimsSummary, useNow } from "@/components/claims/LockedEquity";
import { Empty, Muted, ScanLink } from "@/components/ownership/Ownership";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { addressUrl } from "@/lib/chain";
import { contracts } from "@/lib/contracts";

export default function Portfolio() {
  const { address } = useAccount();
  const { data, isLoading, isError, refetch } = useClaims(address);
  const now = useNow();

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
            <div className="border-b border-ink/15 pb-10">
              <ClaimsSummary claims={data} now={now} />
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((c) => (
                <ClaimCard key={c.id.toString()} c={c} now={now} />
              ))}
            </div>
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
