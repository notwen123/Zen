"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { StatusChip, claimState, fmtTime, fmtUnits } from "@/components/claims/LockedEquity";
import { addressUrl } from "@/lib/chain";
import { contracts } from "@/lib/contracts";
import type { ActivityItem } from "@/lib/zen";

export function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function dayLabel(ts: number) {
  const d = new Date(ts * 1000);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const detail = (it: ActivityItem) =>
  ({
    locked: `locked until ${fmtTime(it.unlockAt)}`,
    cashed: "sold to the instant-exit pool",
    voided: "purchase refunded, claim voided",
    settled: "equity released to holder",
  })[claimState(it)];

/** Editorial timeline of conditional claims (newest first), grouped by the day they were minted. */
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
              <li key={it.id.toString()} className="relative grid grid-cols-[1fr_auto] gap-x-6 py-4 pl-6">
                <span className="absolute -left-[4.5px] top-6 h-2 w-2 rounded-full bg-vermilion" aria-hidden="true" />
                <span className="flex gap-4">
                  {it.brand && <BrandMark brand={it.brand} className="mt-1 h-6 w-9" />}
                  <span>
                    <span className="flex flex-wrap items-center gap-2 font-display text-xl font-bold">
                      {it.brand?.name ?? "Unknown brand"} <StatusChip state={claimState(it)} />
                    </span>
                    <span className="block text-sm text-muted">
                      Claim #{it.id.toString()} · {detail(it)} · {new Date(it.timestamp * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-lg tabular text-ink">
                    {fmtUnits(it.amount)} {it.brand?.asset}
                  </span>
                  <a className="ink-link text-xs" href={addressUrl(contracts.conditionalClaim)} target="_blank" rel="noreferrer">
                    Claim contract ↗
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
  <Link href="/app/scan" className="ink-btn inline-flex min-h-11 items-center gap-3 bg-ink px-6 py-3 text-sm font-semibold text-paper">
    {label}
  </Link>
);
