"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { brandById } from "@/lib/brands";
import { txUrl } from "@/lib/chain";
import { EVENT_LABEL, getIndexedEvents } from "@/lib/indexer";
import { shortAddress, units } from "@/lib/zen";

const fmt = (v: bigint) => units(v).toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Event history from the Envio HyperIndex indexer, with a tx hash on every row. */
export function MarketTape({ account, title = "Market tape", limit = 25 }: { account?: Address; title?: string; limit?: number }) {
  const q = useQuery({
    queryKey: ["indexed", account ?? "all", limit],
    queryFn: () => getIndexedEvents({ account, limit }),
    refetchInterval: 10_000,
    retry: false,
  });
  return (
    <section className="border border-ink/15 bg-paper/60 p-5" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">{title}</p>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
          {q.isError ? "Envio indexer offline · showing contract state elsewhere" : "Indexed by Envio HyperIndex · Monad testnet"}
        </p>
      </div>
      {q.isLoading ? (
        <p className="mt-4 text-sm text-muted">Reading the indexer…</p>
      ) : q.isError ? (
        <p className="mt-4 text-sm text-muted">The event history needs the Envio indexer (see indexer/README.md). Balances and claims on this page are still read live from chain.</p>
      ) : !q.data?.length ? (
        <p className="mt-4 text-sm text-muted">No indexed events yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-ink/10">
          {q.data.map((e) => {
            const b = e.brand ? brandById(e.brand) : undefined;
            return (
              <li key={e.id} className="grid grid-cols-[1fr_auto] gap-x-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{EVENT_LABEL[e.kind]}</span>
                  {e.claimId && <span className="text-muted"> · claim #{e.claimId}</span>}
                  <span className="block text-xs text-muted">
                    {new Date(e.timestamp * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {shortAddress(e.account)}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono tabular">
                    {fmt(e.amount)} {b?.asset ?? ""}
                    {e.price != null && <span className="text-muted"> → {fmt(e.price)}</span>}
                  </span>
                  <a className="ink-link font-mono text-xs" href={txUrl(e.txHash)} target="_blank" rel="noreferrer">
                    {e.txHash.slice(0, 10)}… ↗
                  </a>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
