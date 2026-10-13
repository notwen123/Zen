"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { useAllClaims } from "@/components/hooks/useZen";
import { CountUp } from "@/components/motion/Motion";
import { addressUrl } from "@/lib/chain";
import { BRANDS } from "@/lib/brands";
import { contracts } from "@/lib/contracts";
import { shortAddress, units } from "@/lib/zen";

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** A live claim book, read from the ConditionalClaim contract on Monad testnet. */
export function LivePortfolioPreview() {
  const { data, isLoading, isError } = useAllClaims();
  const locked = data?.filter((c) => c.status === 1) ?? [];
  const rows = BRANDS.map((b) => {
    const mine = data?.filter((c) => c.brand?.id === b.id) ?? [];
    const open = mine.filter((c) => c.status === 1);
    return {
      brand: b,
      open: open.length,
      escrow: open.reduce((s, c) => s + units(c.amount), 0),
      lp: open.filter((c) => c.holder.toLowerCase() === b.exitPool.toLowerCase()).length,
      voided: mine.filter((c) => c.status === 2).length,
      settled: mine.filter((c) => c.status === 3).length,
    };
  });

  return (
    <div className="bg-[#FBF8F1] p-8 shadow-[0_50px_80px_-50px_rgba(23,23,23,.5)] sm:p-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-muted">Claim book</p>
          <p className="mt-1 text-xs text-muted">
            Live · ConditionalClaim{" "}
            <a className="ink-link font-mono" href={addressUrl(contracts.conditionalClaim)} target="_blank" rel="noreferrer">
              {shortAddress(contracts.conditionalClaim)}
            </a>
          </p>
        </div>
        <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-vermilion-deep">Testnet</span>
      </div>

      <div className="mt-10 border-b border-ink/15 pb-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.24em] text-muted">Locked right now</p>
        {isLoading ? (
          <p className="breathe mt-3 font-display text-5xl">Reading chain…</p>
        ) : isError || !data ? (
          <p className="mt-3 font-display text-3xl text-muted">Not available right now.</p>
        ) : (
          <p className="mt-3 flex items-baseline gap-4">
            <CountUp value={locked.length} format={(n) => Math.round(n).toString()} className="font-display text-6xl font-bold tabular" />
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              claims in escrow · {data.length} minted
            </span>
          </p>
        )}
      </div>

      <ul className="divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.brand.id} className="flex items-baseline justify-between gap-4 py-4">
            <span className="flex items-center gap-3 font-display text-2xl">
              <BrandMark brand={r.brand} className="h-5 w-8" />
              {r.brand.name}
            </span>
            <span className="text-right">
              <span className="font-mono text-base tabular">
                {data ? `${fmt(r.escrow)} ${r.brand.asset}` : "—"}
              </span>
              <span className="block font-mono text-[0.65rem] text-muted">
                {r.open} locked · {r.lp} held by LP · {r.voided} voided · {r.settled} settled
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[0.7rem] leading-relaxed text-muted">
        Escrowed amounts are mock tokenized-equity units on Monad testnet. Not market prices, not securities.
      </p>
    </div>
  );
}
