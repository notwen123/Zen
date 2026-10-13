"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { useRecentClaims } from "@/components/hooks/useStockback";
import { CountUp } from "@/components/motion/Motion";
import { txUrl } from "@/lib/chain";
import { inr, shortAddress, units, type ActivityItem } from "@/lib/stockback";

const ago = (ts: number) => {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
};

function Claim({ c }: { c: ActivityItem }) {
  return (
    <a
      href={txUrl(c.txHash)}
      target="_blank"
      rel="noreferrer"
      className="flex shrink-0 items-center gap-3 border-r border-ink/10 px-7 py-1 transition-colors hover:text-vermilion-deep"
    >
      {c.brand && <BrandMark brand={c.brand} className="h-4 w-6" />}
      <span className="font-mono text-xs text-muted">{shortAddress(c.claimant)}</span>
      <span className="font-display text-base font-bold">{c.brand?.name ?? "Brand"}</span>
      <span className="font-mono text-sm tabular">+{inr(units(c.assets))}</span>
      <span className="font-mono text-[0.65rem] text-muted">{ago(c.timestamp)}</span>
    </a>
  );
}

/** Real claims settled on Robinhood testnet, straight from registry events. Nothing here is mocked. */
export function LiveProof() {
  const { data } = useRecentClaims();
  const claims = data ?? [];
  const owners = new Set(claims.map((c) => c.claimant.toLowerCase())).size;
  const issued = claims.reduce((s, c) => s + units(c.assets), 0);

  return (
    <section aria-label="Live on Robinhood testnet" className="relative border-y border-ink/10 bg-paper/70 backdrop-blur-sm">
      <div className="mx-auto grid max-w-[1320px] items-center gap-y-4 px-5 py-5 sm:px-8 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 lg:border-r lg:border-ink/10 lg:pr-8">
          <span className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-vermilion-deep">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vermilion opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vermilion" />
            </span>
            Live · Robinhood testnet
          </span>
          <Stat label="claims settled" value={claims.length} format={(n) => Math.round(n).toString()} />
          <Stat label="owners" value={owners} format={(n) => Math.round(n).toString()} />
          <Stat label="demo value issued" value={issued} format={inr} />
        </div>
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
          {claims.length ? (
            <div className="marquee flex w-max hover:[animation-play-state:paused]">
              {[...claims, ...claims].map((c, i) => (
                <Claim key={`${c.claimId}-${i}`} c={c} />
              ))}
            </div>
          ) : (
            <p className="breathe px-7 font-mono text-xs text-muted">Reading the registry…</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, format }: { label: string; value: number; format: (n: number) => string }) {
  return (
    <span className="flex items-baseline gap-2">
      <CountUp value={value} format={format} className="font-display text-2xl font-bold tabular" />
      <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">{label}</span>
    </span>
  );
}
