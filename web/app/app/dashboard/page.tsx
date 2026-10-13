"use client";

import { useAccount } from "wagmi";
import { useActivity, usePortfolio } from "@/components/hooks/useStockback";
import { ActivityTimeline, Empty, Muted, OwnershipTotal, PositionRow, ScanLink } from "@/components/ownership/Ownership";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 || h >= 17 ? "Good evening." : h < 12 ? "Good morning." : "Good afternoon.";
};

export default function Dashboard() {
  const { address } = useAccount();
  const portfolio = usePortfolio(address);
  const activity = useActivity(address);
  const held = portfolio.data?.positions.filter((p) => p.assets > 0n) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <p className="font-display text-2xl text-charcoal" suppressHydrationWarning>
        {greeting()}
      </p>
      <div className="mt-8 border-b border-ink/15 pb-10">
        <OwnershipTotal total={portfolio.data?.totalUnits} brands={held.length} loading={portfolio.isLoading} />
        {portfolio.isError && <p className="mt-3 text-sm text-vermilion-deep">Couldn&apos;t read your vaults from Robinhood testnet. Retrying shortly.</p>}
      </div>

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="own-h">
          <h2 id="own-h">
            <Muted>Brands you own</Muted>
          </h2>
          {held.length ? (
            <ul className="mt-2 divide-y divide-ink/10">
              {held.map((p) => (
                <PositionRow key={p.id} p={p} />
              ))}
            </ul>
          ) : (
            !portfolio.isLoading && <div className="mt-4"><Empty title="Nothing owned yet." body="Your first claimed purchase will appear here as brand-vault shares." /></div>
          )}
        </section>
        <section aria-labelledby="act-h">
          <h2 id="act-h">
            <Muted>Recent activity</Muted>
          </h2>
          <div className="mt-4">
            {activity.isLoading ? (
              <p className="breathe text-sm text-muted">Reading Robinhood testnet…</p>
            ) : activity.data?.length ? (
              <ActivityTimeline items={activity.data} limit={4} />
            ) : (
              <Empty title="No activity yet." body="Claims you create will be listed here with their transactions." />
            )}
          </div>
        </section>
      </div>

      <div className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-ink/15 pt-10">
        <p className="max-w-md font-display text-2xl">Every receipt is a chance to own a little more of what you buy.</p>
        <ScanLink label={held.length ? "Scan another receipt" : "Scan your first receipt"} />
      </div>
    </div>
  );
}
