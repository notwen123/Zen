"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { formatUnits } from "viem";
import { BrandMark } from "@/components/brand/BrandMark";
import { CountUp } from "@/components/motion/Motion";
import { addressUrl, txUrl } from "@/lib/chain";
import { inr, units, type ActivityItem, type Position } from "@/lib/stockback";

export function Muted({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">{children}</p>;
}

export function OwnershipTotal({ total, brands, loading }: { total?: number; brands?: number; loading?: boolean }) {
  return (
    <div>
      <Muted>Your ownership</Muted>
      {loading ? (
        <p className="breathe mt-3 font-display text-6xl font-bold sm:text-7xl">—</p>
      ) : (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <CountUp value={total ?? 0} format={inr} className="font-display text-6xl font-bold tabular sm:text-7xl" />
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            {brands ?? 0} {brands === 1 ? "brand" : "brands"}
          </span>
        </p>
      )}
      <p className="mt-3 text-xs text-muted">Demo units on Robinhood testnet · 1 unit = ₹1 of demo exposure by convention, not a market price.</p>
    </div>
  );
}

export function PositionRow({ p, count, last }: { p: Position; count?: number; last?: ActivityItem }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 py-5">
      <span className="flex items-center gap-3 font-display text-2xl font-bold">
        <BrandMark brand={p} className="h-6 w-9" />
        {p.name}
      </span>
      <span className="text-right font-mono text-lg tabular">{p.assets > 0n ? inr(units(p.assets)) : "—"}</span>
      <span className="text-xs text-muted">
        {p.category}
        {count !== undefined && ` · ${count} ${count === 1 ? "claim" : "claims"}`}
        {last && ` · last ${new Date(last.timestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
      </span>
      <span className="text-right font-mono text-xs text-muted">
        {units(p.assets).toLocaleString("en-IN", { maximumFractionDigits: 4 })} {p.asset}
      </span>
    </li>
  );
}

export function OwnershipCard({ p, count, last }: { p: Position; count: number; last?: ActivityItem }) {
  return (
    <article className="flex flex-col justify-between bg-[#FBF8F1] p-7 shadow-[0_30px_50px_-40px_rgba(23,23,23,.5)] transition-transform duration-500 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandMark brand={p} className="h-11 w-14" />
          <div>
            <h3 className="font-display text-3xl font-extrabold tracking-[0.04em]">{p.name.toUpperCase()}</h3>
            <p className="mt-1 text-xs text-muted">{p.category}</p>
          </div>
        </div>
        <span className="border border-vermilion/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-vermilion-deep">Testnet · Demo asset</span>
      </div>
      <p className="mt-8 font-display text-4xl font-bold tabular">{p.assets > 0n ? inr(units(p.assets)) : "—"}</p>
      <dl className="mt-6 space-y-2 border-t border-ink/15 pt-4 text-xs">
        <Row k="Underlying" v={`${units(p.assets).toLocaleString("en-IN", { maximumFractionDigits: 4 })} ${p.asset}`} />
        <Row k="Vault shares" v={`${Number(formatUnits(p.shares, 24)).toLocaleString("en-IN", { maximumFractionDigits: 4 })} ${p.share}`} />
        <Row k="Claims" v={String(count)} />
        <Row k="Last claim" v={last ? new Date(last.timestamp * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"} />
      </dl>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs">
        <a className="ink-link" href={addressUrl(p.vault)} target="_blank" rel="noreferrer">
          Vault on explorer ↗
        </a>
        {last && (
          <a className="ink-link" href={txUrl(last.txHash)} target="_blank" rel="noreferrer">
            Last transaction ↗
          </a>
        )}
      </div>
    </article>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted">{k}</dt>
    <dd className="text-right font-mono">{v}</dd>
  </div>
);

function dayLabel(ts: number) {
  const d = new Date(ts * 1000);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Editorial timeline of settled claims, grouped by day. */
export function ActivityTimeline({ items, limit }: { items: ActivityItem[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  const groups = shown.reduce<Record<string, ActivityItem[]>>((g, it) => ((g[dayLabel(it.timestamp)] ??= []).push(it), g), {});
  return (
    <div className="space-y-10">
      {Object.entries(groups).map(([day, list]) => (
        <section key={day} aria-label={day}>
          <Muted>{day}</Muted>
          <ol className="mt-3 border-l border-ink/15">
            {list.map((it) => (
              <li key={it.claimId} className="relative grid grid-cols-[1fr_auto] gap-x-6 py-4 pl-6">
                <span className="absolute -left-[4.5px] top-6 h-2 w-2 rounded-full bg-vermilion" aria-hidden="true" />
                <span className="flex gap-4">
                  {it.brand && <BrandMark brand={it.brand} className="mt-1 h-6 w-9" />}
                  <span>
                  <span className="block font-display text-xl font-bold">{it.brand?.name ?? "Unknown brand"}</span>
                  <span className="block text-sm text-muted">
                    Purchase verified · ₹{(Number(it.purchaseAmountPaise) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} ·{" "}
                    {new Date(it.timestamp * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-lg tabular text-ink">+{inr(units(it.assets))}</span>
                  <a className="ink-link text-xs" href={txUrl(it.txHash)} target="_blank" rel="noreferrer">
                    View transaction →
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function Empty({ title, body, cta }: { title: string; body: string; cta?: ReactNode }) {
  return (
    <div className="border border-dashed border-ink/25 px-6 py-14 text-center">
      <p className="font-display text-2xl font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}

export const ScanLink = ({ label = "Scan a receipt" }: { label?: string }) => (
  <Link href="/app/scan" className="ink-btn inline-flex min-h-11 items-center gap-3 bg-ink px-6 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-paper">
    {label} <span aria-hidden="true">→</span>
  </Link>
);
