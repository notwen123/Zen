"use client";

import { useAccount } from "wagmi";
import { usePools } from "@/components/hooks/useZen";
import { PoolPanel, RiskDisclosure } from "@/components/lp/PoolPanel";
import { Eyebrow } from "@/components/ui/Button";

export default function LpTerminal() {
  const { address } = useAccount();
  const pools = usePools(address);

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <Eyebrow>LP terminal · Monad testnet</Eyebrow>
        <h1 className="mt-3 font-display text-5xl font-bold leading-tight sm:text-6xl">Underwrite refund risk.</h1>
        <p className="mt-4 max-w-2xl text-charcoal">
          Stock-back rewards stay locked until a purchase&apos;s return window closes. Each exit pool buys those locked claims from shoppers at a discount,
          paying them now. If the purchase is kept, the pool collects the full claim; if it is refunded, the pool loses what it paid. As far as we know this is
          the first onchain market that prices consumer refund risk. Every number below is read live from chain.
        </p>
      </header>

      <div className="mt-10">
        <RiskDisclosure />
      </div>

      <div className="mt-12 space-y-10">
        {pools.isLoading ? (
          <p className="breathe font-display text-2xl">Reading pools from chain…</p>
        ) : pools.isError ? (
          <p className="text-vermilion-deep" role="alert">
            Couldn&apos;t read the exit pools from the Monad RPC. Retrying every 15 seconds.
          </p>
        ) : (
          pools.data?.map((p) => <PoolPanel key={p.pool} p={p} address={address} />)
        )}
      </div>
    </div>
  );
}
