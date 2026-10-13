"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { useBrands } from "@/components/hooks/useStockback";
import { BRANDS } from "@/lib/brands";
import { addressUrl } from "@/lib/chain";
import { units, type BrandState } from "@/lib/stockback";

/** Curated gallery of supported brands. Status, reward rate, caps and budget are read from chain. */
export function BrandGallery({ compact }: { compact?: boolean }) {
  const { data, isLoading, isError } = useBrands();
  const rows: (BrandState | (typeof BRANDS)[number])[] = data ?? BRANDS;
  return (
    <div>
      <ul className={`grid gap-px bg-ink/10 ${compact ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
        {rows.map((b) => {
          const live = "active" in b ? b : undefined;
          const status = !live ? (isLoading ? "Reading chain…" : "Status unavailable") : live.active && live.budget > 0n ? "Available · demo" : "Paused";
          return (
            <li key={b.id} className="flex flex-col bg-paper p-7">
              <div className="flex h-36 items-center justify-center border-b border-ink/10">
                <BrandMark brand={b} className="h-20 w-28" />
              </div>
              <div className="mt-6 flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                  <h3 className="font-display text-3xl font-extrabold tracking-[0.04em]">{b.name}</h3>
                  <p className="mt-1 text-xs text-muted">{b.category}</p>
                  </div>
                </div>
                <span className="border border-vermilion/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-vermilion-deep">Demo asset</span>
              </div>
              <dl className="mt-6 space-y-2 border-t border-ink/15 pt-4 text-xs">
                <Row k="Status" v={<span className="inline-flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${live?.active ? "bg-vermilion" : "bg-stone"}`} />{status}</span>} />
                <Row k="Demo reward" v={live ? `${live.rewardPercent.toLocaleString("en-IN", { maximumFractionDigits: 2 })}% of purchase` : "—"} />
                <Row k="Per claim cap" v={live ? `${units(live.perClaimCap).toLocaleString("en-IN")} ${b.asset}` : "—"} />
                <Row k="Eligible purchases" v={live ? `₹${(Number(live.minAmount) / 100).toLocaleString("en-IN")} – ₹${(Number(live.maxAmount) / 100).toLocaleString("en-IN")} · ${live.currency}` : "—"} />
                {!compact && <Row k="Reward budget" v={live ? `${units(live.budget).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${b.asset}` : "—"} />}
                <Row k="Vault" v={<a className="ink-link font-mono" href={addressUrl(b.vault)} target="_blank" rel="noreferrer">{b.share} ↗</a>} />
              </dl>
            </li>
          );
        })}
      </ul>
      {isError && <p className="mt-4 text-sm text-vermilion-deep">Live status couldn&apos;t be read from Robinhood testnet right now.</p>}
      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">
        Brand names identify demo vaults only. STOCKBACK has no partnership with these companies, and the vault assets are simulated testnet tokens,
        not securities. More brands: coming soon.
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}
