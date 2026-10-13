"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useAccount } from "@/lib/account";
import { usePools } from "@/components/hooks/useZen";
import { PoolPanel, RiskDisclosure } from "@/components/lp/PoolPanel";
import { Eyebrow } from "@/components/ui/Button";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { MarketTape } from "@/components/indexer/MarketTape";
import { BrandMark } from "@/components/brand/BrandMark";
import { units } from "@/lib/zen";

const num = (v: bigint, d = 2) => units(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function LpTerminal() {
  const { address } = useAccount();
  const pools = usePools(address);
  const [tab, setTab] = useState(0);
  const p = pools.data?.[tab];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>LP terminal · Monad testnet</Eyebrow>
          <h1 className="mt-3 font-display text-5xl font-bold leading-tight">Underwrite refund risk.</h1>
          <p className="mt-3 max-w-xl text-charcoal">
            Pools buy locked stock-back claims at a discount. Kept purchases pay the pool the full claim; refunded ones cost it what it paid. Every number is read live
            from chain.
          </p>
        </div>
        {!address && <ConnectWallet />}
      </header>

      <div className="mt-6">
        <RiskDisclosure />
      </div>

      {pools.isLoading ? (
        <p className="breathe mt-10 font-display text-2xl">Reading pools from chain…</p>
      ) : pools.isError || !pools.data ? (
        <p className="mt-10 text-vermilion-deep" role="alert">
          Couldn&apos;t read the exit pools from the Monad RPC. Retrying every 15 seconds.
        </p>
      ) : (
        <>
          {/* Pool switcher doubles as the summary strip: NAV and P&L for every pool at a glance. */}
          <div role="tablist" aria-label="Exit pools" className="mt-8 grid gap-3 sm:grid-cols-3">
            {pools.data.map((x, i) => {
              const net = x.realizedGains - x.realizedLosses;
              const on = i === tab;
              return (
                <button
                  key={x.pool}
                  role="tab"
                  aria-selected={on}
                  aria-controls="pool-panel"
                  onClick={() => setTab(i)}
                  className={`flex items-center gap-3 border p-4 text-left transition-colors ${on ? "border-ink bg-[#FBF8F1] shadow-[0_20px_40px_-30px_rgba(23,23,23,.6)]" : "border-ink/15 hover:border-ink/40"}`}
                >
                  <BrandMark brand={x.brand} className="h-8 w-11 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold">{x.brand.name}</span>
                    <span className="block font-mono text-xs tabular text-muted">
                      NAV {num(x.totalAssets)} {x.brand.asset}
                    </span>
                  </span>
                  <span className={`font-mono text-sm tabular ${net < 0n ? "text-vermilion-deep" : "text-ink"}`}>
                    {net > 0n ? "+" : net < 0n ? "−" : ""}
                    {num(net < 0n ? -net : net)}
                  </span>
                </button>
              );
            })}
          </div>

          <div id="pool-panel" role="tabpanel" className="mt-4">
            <AnimatePresence mode="wait">
              {p && (
                <motion.div key={p.pool} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <PoolPanel p={p} address={address} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      <div className="mt-10">
        <MarketTape title="Market tape · cash-outs, refunds, settlements, LP flows" limit={8} more />
      </div>
    </div>
  );
}
