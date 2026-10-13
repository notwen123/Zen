"use client";

import { useAccount } from "wagmi";
import { useActivity, usePortfolio } from "@/components/hooks/useStockback";
import { Empty, OwnershipCard, OwnershipTotal, ScanLink } from "@/components/ownership/Ownership";

export default function Portfolio() {
  const { address } = useAccount();
  const portfolio = usePortfolio(address);
  const activity = useActivity(address);
  const positions = portfolio.data?.positions ?? [];
  const held = positions.filter((p) => p.assets > 0n);

  return (
    <div className="mx-auto max-w-6xl">
      <OwnershipTotal total={portfolio.data?.totalUnits} brands={held.length} loading={portfolio.isLoading} />
      <div className="mt-12">
        {portfolio.isLoading ? null : held.length ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {held.map((p) => {
              const mine = activity.data?.filter((a) => a.brand?.id === p.id) ?? [];
              return <OwnershipCard key={p.id} p={p} count={mine.length} last={mine[0]} />;
            })}
          </div>
        ) : (
          <Empty title="Your portfolio is empty." body="Verify a purchase to receive shares in that brand's vault." cta={<ScanLink />} />
        )}
      </div>
      <p className="mt-10 max-w-2xl text-xs leading-relaxed text-muted">
        Balances are read directly from each brand&apos;s ERC-4626 vault on Robinhood Chain testnet. The underlying assets are simulated demo tokens
        (mNKE, mAAPL, mSBUX). They are not securities and are not affiliated with the brands shown.
      </p>
    </div>
  );
}
