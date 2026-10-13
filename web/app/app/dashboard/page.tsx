"use client";

import Link from "next/link";
import { useAccount } from "@/lib/account";
import { useActivity, useClaims } from "@/components/hooks/useZen";
import { ClaimsSummary, useNow } from "@/components/claims/LockedEquity";
import { ActivityTimeline, Empty, Muted, ScanLink } from "@/components/ownership/Ownership";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 || h >= 17 ? "Good evening." : h < 12 ? "Good morning." : "Good afternoon.";
};

export default function Dashboard() {
  const { address } = useAccount();
  const claims = useClaims(address);
  const activity = useActivity(address);
  const now = useNow();

  return (
    <div className="mx-auto max-w-5xl">
      <p className="font-display text-2xl text-charcoal" suppressHydrationWarning>
        {greeting()}
      </p>
      <div className="mt-8 border-b border-ink/15 pb-10">
        {!address ? (
          <Empty title="Connect your wallet." body="See your locked equity, what unlocks next and what you can cash out." cta={<ConnectWallet />} />
        ) : claims.isLoading ? (
          <p className="breathe font-display text-6xl font-bold" role="status" aria-label="Loading your claims">
            —
          </p>
        ) : claims.isError ? (
          <p className="text-sm text-vermilion-deep">Couldn&apos;t read your claims from Monad testnet. Retrying shortly.</p>
        ) : (
          <>
            <ClaimsSummary claims={claims.data ?? []} now={now} />
            <Link href="/app/portfolio" className="ink-link mt-6 inline-block text-sm">
              Manage locked equity: cash out or settle →
            </Link>
          </>
        )}
      </div>

      {address && (
        <section aria-labelledby="act-h" className="mt-12">
          <h2 id="act-h">
            <Muted>Recent activity</Muted>
          </h2>
          <div className="mt-4">
            {activity.isLoading ? (
              <p className="breathe text-sm text-muted">Reading Monad testnet…</p>
            ) : activity.isError ? (
              <p className="text-sm text-vermilion-deep">Activity isn&apos;t available right now.</p>
            ) : activity.data?.length ? (
              <ActivityTimeline items={activity.data} limit={4} />
            ) : (
              <Empty title="No activity yet." body="Each verified purchase becomes a locked equity claim, listed here." />
            )}
          </div>
        </section>
      )}

      <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-ink/15 pt-10">
        <p className="max-w-md font-display text-2xl">Every receipt is a chance to own a little more of what you buy.</p>
        <ScanLink label={claims.data?.length ? "Scan another receipt" : "Scan your first receipt"} />
      </div>
    </div>
  );
}
