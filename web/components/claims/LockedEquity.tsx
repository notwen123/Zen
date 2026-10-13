"use client";

import { refreshAfterTx } from "@/lib/refresh";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
import { useWriteContract } from "@/lib/account";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button } from "@/components/ui/Button";
import type { Brand } from "@/lib/brands";
import { instantExitPoolAbi } from "@/lib/contracts";
import {
  CATEGORY_LABEL,
  approveClaimRequest,
  classifyClaimError,
  getTransactionUrl,
  inr,
  publicClient,
  sellClaimRequest,
  settleRequest,
  units,
  type LockedClaim,
} from "@/lib/zen";

// ------------------------------------------------------------------ helpers

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const fmtUnits = (v: bigint) => units(v).toLocaleString("en-IN", { maximumFractionDigits: 4 });
export const fmtTime = (s: number) =>
  new Date(s * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** 90 → "01:30", 4000 → "1:06:40", 200000 → "2d 07h 33m". */
export function countdown(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const p = (n: number) => String(n).padStart(2, "0");
  const d = Math.floor(s / 86_400), h = Math.floor((s % 86_400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${p(h)}h ${p(m)}m` : h ? `${h}:${p(m)}:${p(s % 60)}` : `${p(m)}:${p(s % 60)}`;
}

/** Wall clock in unix seconds, ticking every second (client only). */
export function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export type ClaimState = "locked" | "cashed" | "voided" | "settled";
export const CLAIM_STATE_LABEL: Record<ClaimState, string> = { locked: "Locked", cashed: "Cashed out", voided: "Voided (refunded)", settled: "Settled" };

/** A claim held by its brand's exit pool was sold by the claimant: "Cashed out", whatever happened to it after. */
export function claimState(c: { status: number; holder: Address; brand?: Brand }): ClaimState {
  if (same(c.holder, c.brand?.exitPool)) return "cashed";
  return c.status === 2 ? "voided" : c.status === 3 ? "settled" : "locked";
}

const CHIP: Record<ClaimState, string> = {
  locked: "border border-ink text-ink",
  cashed: "border border-ink/40 text-muted",
  voided: "border border-vermilion text-vermilion-deep",
  settled: "bg-ink text-paper",
};

export const StatusChip = ({ state }: { state: ClaimState }) => (
  <span className={`whitespace-nowrap px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${CHIP[state]}`}>{CLAIM_STATE_LABEL[state]}</span>
);

const DemoBadge = () => (
  <span
    className="whitespace-nowrap border border-vermilion/50 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-vermilion-deep"
    title="Testnet uses a short demo return window (minutes). Production windows are 14 to 30 days."
  >
    Demo window
  </span>
);

const eyebrow = "font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted";

// ------------------------------------------------------------------ summary

export function ClaimsSummary({ claims, now }: { claims: LockedClaim[]; now: number }) {
  const withState = claims.map((c) => ({ c, s: claimState(c) }));
  const locked = withState.filter((x) => x.s === "locked").map((x) => x.c);
  const total = locked.reduce((s, c) => s + c.amount, 0n);
  const byAsset = Object.entries(
    locked.reduce<Record<string, bigint>>((m, c) => ((m[c.brand?.asset ?? "units"] = (m[c.brand?.asset ?? "units"] ?? 0n) + c.amount), m), {}),
  );
  const next = locked.filter((c) => c.unlockAt > now).sort((a, b) => a.unlockAt - b.unlockAt)[0];
  const ready = locked.filter((c) => c.unlockAt <= now).length;
  const count = (s: ClaimState) => withState.filter((x) => x.s === s).length;

  return (
    <div className="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <p className={eyebrow}>Locked equity</p>
        <p className="mt-3 font-display text-6xl font-bold tabular sm:text-7xl">{inr(units(total))}</p>
        <p className="mt-2 font-mono text-xs text-muted">{byAsset.length ? byAsset.map(([a, v]) => `${fmtUnits(v)} ${a}`).join(" · ") : "Nothing locked right now"}</p>
      </div>
      <div>
        <p className={eyebrow}>Unlocking next</p>
        {next ? (
          <>
            <p className="mt-3 font-display text-3xl font-bold tabular">
              {fmtUnits(next.amount)} {next.brand?.asset}
            </p>
            <p className="mt-1 font-mono text-xs text-muted">
              in <span className="tabular text-ink">{countdown(next.unlockAt - now)}</span> · {fmtTime(next.unlockAt)}
            </p>
          </>
        ) : (
          <p className="mt-3 font-display text-3xl font-bold">—</p>
        )}
        {ready > 0 && <p className="mt-2 text-xs text-vermilion-deep">{ready} unlocked and ready to settle</p>}
      </div>
      <div>
        <p className={eyebrow}>Claims</p>
        <dl className="mt-3 space-y-1 text-sm">
          {(["locked", "cashed", "settled", "voided"] as const).map((s) => (
            <div key={s} className="flex justify-between gap-4">
              <dt className="text-muted">{CLAIM_STATE_LABEL[s]}</dt>
              <dd className="font-mono tabular">{count(s)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="text-xs text-muted sm:col-span-3">
        Demo units on Monad testnet · 1 unit = ₹1 of demo exposure by convention, not a market price.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ card

type Tx = { phase: "wallet" | "pending" | "done" | "error"; label: string; hash?: Hex; detail?: string };

/** Friendly copy for the reverts a user can actually hit here. */
function txError(e: unknown) {
  const err = classifyClaimError(e);
  if (err.kind === "rejected") return "Declined in your wallet. Nothing changed.";
  if (err.kind === "funds") return "Your wallet needs a little testnet MON for gas.";
  const d = err.kind === "other" ? err.detail : "";
  if (/InsufficientLiquidity/.test(d)) return "The pool doesn't have enough liquidity for this claim right now.";
  if (/MinHold/.test(d)) return "This claim is still in its minimum hold. Try again when the timer ends.";
  if (/Slippage/.test(d)) return "The price moved. Try again for a fresh quote.";
  if (/NotForSale|NotLocked|StillLocked/.test(d)) return "This claim's state changed. Refresh and try again.";
  return d || "Something went wrong. Try again.";
}

export function ClaimCard({ c, now }: { c: LockedClaim; now: number }) {
  const qc = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const [tx, setTx] = useState<Tx>();
  const [approved, setApproved] = useState(false);
  const state = claimState(c);
  const asset = c.brand?.asset ?? "units";
  const pool = c.brand?.exitPool;
  const left = c.unlockAt - now;
  const busy = tx?.phase === "wallet" || tx?.phase === "pending";
  const canAct = state === "locked" && !!pool;

  async function send(label: string, req: Parameters<typeof writeContractAsync>[0]) {
    setTx({ phase: "wallet", label });
    const hash = await writeContractAsync(req);
    setTx({ phase: "pending", label, hash });
    const r = await publicClient.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
    return hash;
  }

  const refresh = () =>
    refreshAfterTx(qc);

  async function cashOut() {
    if (!pool) return;
    try {
      if (!approved) {
        await send("Step 1 of 2 · Approve the pool to take this claim", approveClaimRequest(pool, c.id));
        setApproved(true);
      }
      // Fresh quote right before selling: the price drifts as the unlock approaches.
      const [price] = await publicClient.readContract({ address: pool, abi: instantExitPoolAbi, functionName: "quote", args: [c.id] });
      if (!price) throw new Error("NotForSale");
      const hash = await send("Step 2 of 2 · Sell the claim to the pool", sellClaimRequest(pool, c.id, price));
      setTx({ phase: "done", label: `Cashed out for ${fmtUnits(price)} ${asset}`, hash });
      await refresh();
    } catch (e) {
      setTx((t) => ({ phase: "error", label: t?.label ?? "Cash out", hash: t?.hash, detail: txError(e) }));
    }
  }

  async function settle() {
    try {
      const hash = await send("Settling claim", settleRequest(c.id));
      setTx({ phase: "done", label: `Settled: ${fmtUnits(c.amount)} ${asset} sent to your wallet`, hash });
      await refresh();
    } catch (e) {
      setTx((t) => ({ phase: "error", label: t?.label ?? "Settle", hash: t?.hash, detail: txError(e) }));
    }
  }

  return (
    <article className="flex flex-col bg-[#FBF8F1] p-7 shadow-[0_30px_50px_-40px_rgba(23,23,23,.5)]" aria-labelledby={`claim-${c.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {c.brand && <BrandMark brand={c.brand} className="h-10 w-14" />}
          <div>
            <h3 id={`claim-${c.id}`} className="font-display text-2xl font-extrabold tracking-[0.04em]">
              {c.brand?.name.toUpperCase() ?? "UNKNOWN BRAND"}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Claim #{c.id.toString()} · {CATEGORY_LABEL[c.category] ?? `Category ${c.category}`}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusChip state={state} />
          {c.demoWindow && <DemoBadge />}
        </div>
      </div>

      <p className="mt-7 font-display text-4xl font-bold tabular">
        {fmtUnits(c.amount)} <span className="text-2xl">{asset}</span>
      </p>
      <p className="mt-2 font-mono text-xs text-muted">
        {state === "locked" ? (
          left > 0 ? (
            <>
              Unlocks in <span className="tabular text-ink">{countdown(left)}</span> · {fmtTime(c.unlockAt)}
            </>
          ) : (
            <>Return window closed {fmtTime(c.unlockAt)} · ready to settle</>
          )
        ) : state === "cashed" ? (
          "Sold to the instant-exit pool. The pool now carries the refund risk."
        ) : state === "voided" ? (
          "The purchase was refunded inside the return window. The escrow went back to the sponsor."
        ) : (
          `Settled. The ${asset} was released to the holder.`
        )}
      </p>

      {canAct && left > 0 && <CashOutQuote c={c} now={now} />}

      <div className="mt-auto pt-6">
        {canAct && left > 0 && (
          <Button className="w-full" onClick={cashOut} disabled={busy || c.quote === 0n || now < c.sellableAt}>
            {now < c.sellableAt
              ? `Sellable in ${countdown(c.sellableAt - now)} (minimum hold)`
              : c.quote === 0n
                ? "Pool not buying right now"
                : `Cash out now · ${fmtUnits(c.quote)} ${asset}`}
          </Button>
        )}
        {canAct && left <= 0 && (
          <Button className="w-full" onClick={settle} disabled={busy}>
            Settle · receive {fmtUnits(c.amount)} {asset}
          </Button>
        )}
        <div aria-live="polite" role="status">
          {tx && (
            <div className={`mt-4 border-l-2 pl-3 text-xs ${tx.phase === "error" ? "border-vermilion" : "border-ink"}`}>
              <p className="font-semibold">{tx.label}</p>
              <p className={tx.phase === "error" ? "text-vermilion-deep" : "text-muted"}>
                {tx.phase === "wallet"
                  ? "Confirm in your wallet…"
                  : tx.phase === "pending"
                    ? "Waiting for Monad to confirm…"
                    : tx.phase === "done"
                      ? "Confirmed on Monad testnet."
                      : tx.detail}
              </p>
              {tx.hash && (
                <a className="ink-link font-mono" href={getTransactionUrl(tx.hash)} target="_blank" rel="noreferrer">
                  {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)} · view on explorer ↗
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CashOutQuote({ c, now }: { c: LockedClaim; now: number }) {
  if (c.quote === 0n) return null;
  const asset = c.brand?.asset ?? "units";
  const discount = 100 - Number((c.quote * 10_000n) / c.amount) / 100;
  return (
    <div className="mt-6 border-t border-ink/15 pt-4 text-xs">
      <div className="flex items-baseline justify-between gap-4">
        <span className={eyebrow}>Instant exit quote</span>
        <span className="font-mono tabular">
          {fmtUnits(c.quote)} {asset} · −{discount.toFixed(2)}%
        </span>
      </div>
      <p className="mt-2 leading-relaxed text-charcoal">
        You get {fmtUnits(c.quote)} {asset} now instead of {fmtUnits(c.amount)} {asset} on {fmtTime(c.unlockAt)}. The pool takes the risk that this
        purchase is refunded; if it is, you keep what you were paid and the pool absorbs the loss.
      </p>
      {now < c.sellableAt && <p className="mt-1 text-muted">Live quote; selling opens after a short minimum hold.</p>}
    </div>
  );
}
