"use client";

import type { Address } from "viem";
import { BrandMark } from "@/components/brand/BrandMark";
import { CountUp } from "@/components/motion/Motion";
import { usePortfolio } from "@/components/hooks/useStockback";
import { addressUrl } from "@/lib/chain";
import { deploymentInfo } from "@/lib/contracts";
import { inr, shortAddress, units } from "@/lib/stockback";

const DEMO_WALLET = deploymentInfo.deployer as Address;

/** A real statement, read live from Robinhood testnet for the public demo wallet. */
export function LivePortfolioPreview() {
  const { data, isLoading, isError } = usePortfolio(DEMO_WALLET);
  const held = data?.positions.filter((p) => p.assets > 0n) ?? [];

  return (
    <div className="bg-[#FBF8F1] p-8 shadow-[0_50px_80px_-50px_rgba(23,23,23,.5)] sm:p-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-muted">Ownership statement</p>
          <p className="mt-1 text-xs text-muted">
            Live · demo wallet{" "}
            <a className="ink-link font-mono" href={addressUrl(DEMO_WALLET)} target="_blank" rel="noreferrer">
              {shortAddress(DEMO_WALLET)}
            </a>
          </p>
        </div>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-vermilion-deep">Testnet</span>
      </div>

      <div className="mt-10 border-b border-ink/15 pb-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-muted">Brands you own</p>
        {isLoading ? (
          <p className="breathe mt-3 font-display text-5xl">Reading chain…</p>
        ) : isError || !data ? (
          <p className="mt-3 font-display text-3xl text-muted">Not available right now.</p>
        ) : (
          <p className="mt-3 flex items-baseline gap-4">
            <CountUp value={data.totalUnits} format={inr} className="font-display text-6xl font-bold tabular" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{held.length} brands</span>
          </p>
        )}
      </div>

      <ul className="divide-y divide-ink/10">
        {data?.positions.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between py-4">
            <span className="flex items-center gap-3 font-display text-2xl">
              <BrandMark brand={p} className="h-5 w-8" />
              {p.name}
            </span>
            <span className="text-right">
              <span className="font-mono text-base tabular">{p.assets > 0n ? inr(units(p.assets)) : "—"}</span>
              <span className="block font-mono text-[0.65rem] text-muted">
                {units(p.assets).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {p.asset}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[0.7rem] leading-relaxed text-muted">
        Values in demo units: by testnet convention 1 {`m`}-unit = ₹1 of demo exposure. Not market prices, not securities.
      </p>
    </div>
  );
}
