"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { BrandMark } from "@/components/brand/BrandMark";
import { usePoolClaims } from "@/components/hooks/useZen";
import { LpActions, Stat, TxStatus, fmt, useTx } from "@/components/lp/LpActions";
import { addressUrl } from "@/lib/chain";
import { conditionalClaimAbi, contracts } from "@/lib/contracts";
import { CATEGORY_LABEL, publicClient, settleRequest, shortAddress, type LockedClaim, type PoolState } from "@/lib/zen";

const YEAR = 365 * 86_400;
const DAY = 86_400;
/** Production return windows from script/DeployZen.s.sol (non-demo branch). The live chain runs short demo windows. */
const PRODUCTION_WINDOW: Record<number, number> = { 1: 30 * DAY, 2: 14 * DAY, 3: 14 * DAY };

const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;
const bps = (b: number) => pct(b / 10_000);

function duration(s: number) {
  if (s >= DAY) return `${+(s / DAY).toFixed(1)} d`;
  if (s >= 3600) return `${+(s / 3600).toFixed(1)} h`;
  if (s >= 60) return `${+(s / 60).toFixed(1)} min`;
  return `${s} s`;
}

function countdown(s: number) {
  const d = Math.floor(s / DAY);
  const h = Math.floor((s % DAY) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Live return window for a category, read from ConditionalClaim. */
function useReturnWindow(category: number) {
  return useQuery({
    queryKey: ["returnWindow", category],
    staleTime: 60_000,
    queryFn: async () => {
      const [seconds, demo] = await publicClient.multicall({
        contracts: [
          { address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "returnWindow", args: [category] },
          { address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "isDemoWindow", args: [category] },
        ],
        allowFailure: false,
      });
      return { seconds: Number(seconds), demo: Boolean(demo) };
    },
  });
}

/**
 * Reference claim of 1 unit, clean wallet (risk multiplier 1x), bought at mint with T seconds to unlock.
 * Mirrors InstantExitPool.priceFor (bps rounding ignored).
 */
export function expectedReturnModel(pRefundBps: number, timeValueBps: number, lpFeeBps: number, T: number) {
  const p = pRefundBps / 10_000;
  const tv = Math.min((timeValueBps / 10_000) * (T / YEAR), 1);
  const fee = lpFeeBps / 10_000;
  const price = (1 - p) * (1 - tv) * (1 - fee);
  const expected = 1 - p; // settles -> 1, refunded (voided) -> 0
  const r = expected / price - 1;
  return { p, tv, fee, price, expected, r, apr: (r * YEAR) / T, breakEven: 1 - price };
}

export function RiskDisclosure() {
  return (
    <details aria-labelledby="risk-title" className="group border-l-4 border-vermilion bg-[#FBF8F1] px-5 py-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span id="risk-title" className="text-sm text-charcoal">
          <b className="font-mono text-xs uppercase tracking-[0.2em] text-vermilion-deep">Risk · </b>
          Testnet mock assets. LPs lose the full price paid on every refunded claim, and capital in held claims can&apos;t be withdrawn until they resolve.
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-vermilion-deep">
          <span className="group-open:hidden">Read all 7 risks ↓</span>
          <span className="hidden group-open:inline">Hide ↑</span>
        </span>
      </summary>
      <ul className="mt-4 grid gap-x-10 gap-y-3 text-sm leading-relaxed text-charcoal md:grid-cols-2">
        <li>
          <b className="text-ink">Testnet, mock assets.</b> mNKE, mAAPL and mSBUX are demo tokens on Monad testnet. They are not securities, have no value and
          are not affiliated with the brands named.
        </li>
        <li>
          <b className="text-ink">You lose the full price on every refund.</b> When a purchase behind a held claim is refunded, the claim is voided and the pool
          loses everything it paid for it.
        </li>
        <li>
          <b className="text-ink">Capital in held claims is locked.</b> Withdrawals are paid only from idle assets. What the pool has spent on claims comes back
          only when each claim settles or is voided.
        </li>
        <li>
          <b className="text-ink">NAV carries claims at cost.</b> Expected refunds are not marked in advance: a void lowers the share price at the moment it
          happens, including for anyone who deposited after the claim was bought.
        </li>
        <li>
          <b className="text-ink">Parameters are set by a demo admin.</b> Refund probabilities, fee, time value and risk slope are chosen by a single demo
          admin key (bounded onchain). In production this would be a timelock or governance.
        </li>
        <li>
          <b className="text-ink">Adverse selection.</b> Shoppers who expect to return a purchase are the most eager to sell. Defenses: a minimum hold before
          a claim can be sold, a wallet risk multiplier that rises with the wallet&apos;s onchain refund history, and refund proofs that void claims.
          None of these is complete.
        </li>
        <li>
          <b className="text-ink">Not audited. No yield is promised.</b> Every return figure on this page is a model output under stated assumptions.
        </li>
      </ul>
    </details>
  );
}

export function PoolPanel({ p, address }: { p: PoolState; address?: Address }) {
  const net = p.realizedGains - p.realizedLosses;
  const idlePct = p.totalAssets > 0n ? Number((p.idle * 10_000n) / p.totalAssets) / 100 : 0;
  const utilization = p.totalAssets > 0n ? Number((p.booked * 10_000n) / p.totalAssets) / 10_000 : 0;
  const a = p.brand.asset;
  const apr = expectedReturnModel(p.category.pRefundBps, p.timeValueBps, p.lpFeeBps, PRODUCTION_WINDOW[p.category.category]);

  return (
    <article aria-labelledby={`pool-${p.brand.id}`} className="bg-[#FBF8F1] p-6 shadow-[0_30px_50px_-40px_rgba(23,23,23,.5)] sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandMark brand={p.brand} className="h-11 w-14" />
          <div>
            <h3 id={`pool-${p.brand.id}`} className="font-display text-3xl font-extrabold tracking-[0.04em]">
              {p.brand.name.toUpperCase()} <span className="font-mono text-base font-normal tracking-normal text-muted">{a} exit pool</span>
            </h3>
            <p className="mt-1 text-xs text-muted">
              {CATEGORY_LABEL[p.category.category]} ·{" "}
              <a className="ink-link" href={addressUrl(p.pool)} target="_blank" rel="noreferrer">
                {shortAddress(p.pool)} ↗
              </a>
              {!p.category.enabled && <span className="ml-2 text-vermilion-deep">· buying disabled</span>}
            </p>
          </div>
        </div>
        <span className="border border-vermilion/50 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.18em] text-vermilion-deep">
          Testnet · Demo asset
        </span>
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <div className="col-span-2">
          <dt className="text-xs text-muted">NAV (total assets)</dt>
          <dd className="mt-1 font-display text-4xl font-bold tabular">
            {fmt(p.totalAssets, 2)} <span className="font-mono text-sm font-normal text-muted">{a}</span>
          </dd>
        </div>
        <Stat k="Net realized P&L" v={`${net > 0n ? "+" : ""}${fmt(net)}`} tone={net < 0n ? "loss" : "gain"} />
        <Stat k="Model APR (production window)" v={pct(apr.apr)} />
      </dl>

      <div className="mt-6">
        <div className="flex justify-between font-mono text-xs tabular">
          <span>
            <span className="mr-2 inline-block h-2 w-2 bg-ink align-middle" aria-hidden="true" />
            Idle {fmt(p.idle)}
          </span>
          <span>
            In claims {fmt(p.booked)}
            <span className="ml-2 inline-block h-2 w-2 bg-vermilion align-middle" aria-hidden="true" />
          </span>
        </div>
        <div
          className="mt-2 flex h-2.5 overflow-hidden bg-stone/40"
          role="img"
          aria-label={p.totalAssets > 0n ? `${idlePct.toFixed(1)}% idle, ${(100 - idlePct).toFixed(1)}% locked in claims` : "Pool is empty"}
        >
          {p.totalAssets > 0n && (
            <>
              <span className="bg-ink transition-[width] duration-700 ease-out" style={{ width: `${idlePct}%` }} />
              <span className="flex-1 bg-vermilion" />
            </>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          {address ? (
            <LpActions p={p} address={address} />
          ) : (
            <p className="border border-dashed border-ink/25 p-5 text-sm text-muted">Sign in with your passkey above to deposit into or withdraw from this pool.</p>
          )}
        </div>
        <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-4 text-sm">
          <Stat k={`Share price (${a})`} v={p.navPerShare.toLocaleString("en-IN", { minimumFractionDigits: 6, maximumFractionDigits: 6 })} />
          <Stat k="Utilization" v={pct(utilization, 1)} />
          <Stat k="Claims bought" v={p.claimsBought.toString()} />
          <Stat k="Currently held" v={p.heldCount.toString()} />
          <Stat k="Realized gains" v={`+${fmt(p.realizedGains)}`} />
          <Stat k="Realized losses" v={p.realizedLosses > 0n ? `−${fmt(p.realizedLosses)}` : fmt(0n)} tone={p.realizedLosses > 0n ? "loss" : undefined} />
          <Stat k={`Refund probability · ${CATEGORY_LABEL[p.category.category]}`} v={bps(p.category.pRefundBps)} />
          <Stat k="Break-even refund rate" v={pct(apr.breakEven)} />
        </dl>
      </div>

      <details className="group mt-8 border-t border-ink/15 pt-5">
        <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted hover:text-ink">
          How this pool prices claims · APR model and assumptions
          <span className="group-open:rotate-180 transition-transform" aria-hidden="true">↓</span>
        </summary>
        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          <Params p={p} />
          <Model p={p} utilization={utilization} />
        </div>
      </details>

      <div className="mt-6 border-t border-ink/15 pt-5">
        <ClaimsTable p={p} />
      </div>
    </article>
  );
}

function Params({ p }: { p: PoolState }) {
  const win = useReturnWindow(p.category.category);
  return (
    <section aria-label="Pricing parameters">
      <h4 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">Pricing parameters (onchain)</h4>
      <dl className="mt-4 divide-y divide-ink/10 text-sm">
        <Row k={`Refund probability · ${CATEGORY_LABEL[p.category.category]}`} v={bps(p.category.pRefundBps)} note="Illustrative demo parameter set by the demo admin." />
        <Row k="Minimum hold before sale" v={duration(p.category.minHoldSeconds)} />
        <Row k="Time value (annualized)" v={bps(p.timeValueBps)} />
        <Row k="LP fee" v={bps(p.lpFeeBps)} />
        <Row
          k="Wallet risk slope"
          v={bps(p.riskSlopeBps)}
          note="Risk multiplier = 1 + slope × wallet voids ÷ wallet claims, capped at 3×. Clean wallets pay 1×."
        />
        <Row
          k="Return window (live)"
          v={win.data ? `${duration(win.data.seconds)}${win.data.demo ? " · demo" : ""}` : "—"}
          note={win.data?.demo ? "Shortened so the demo resolves in minutes." : undefined}
        />
      </dl>
      <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted">
        price = face × (1 − pRefund × riskMult) × (1 − timeValue × T ÷ year) × (1 − fee)
      </p>
    </section>
  );
}

function Model({ p, utilization }: { p: PoolState; utilization: number }) {
  const T = PRODUCTION_WINDOW[p.category.category];
  const m = expectedReturnModel(p.category.pRefundBps, p.timeValueBps, p.lpFeeBps, T);
  const a = p.brand.asset;
  return (
    <section aria-label="Expected return model">
      <h4 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">Expected APR · model, not a promise</h4>
      <p className="mt-3 text-xs leading-relaxed text-charcoal">
        Reference claim with face 1 {a} from a clean wallet (risk 1×), bought at mint with T = {duration(T)} to unlock (the production return window for{" "}
        {CATEGORY_LABEL[p.category.category].toLowerCase()}), assuming the realized refund rate equals p = {pct(m.p)}.
      </p>
      <dl className="mt-4 divide-y divide-ink/10 text-sm">
        <Row k="Price paid = (1 − p)(1 − tv·T/yr)(1 − fee)" v={m.price.toFixed(6)} />
        <Row k="Expected payoff = (1 − p) × 1 + p × 0" v={m.expected.toFixed(6)} />
        <Row k="Expected return r = payoff ÷ price − 1" v={pct(m.r, 3)} />
        <Row k="Model APR on capital in claims = r × yr ÷ T" v={pct(m.apr)} strong />
        <Row k={`Pool-level at current utilization (${pct(utilization, 1)})`} v={pct(m.apr * utilization)} />
        <Row k="Break-even refund rate = 1 − price" v={pct(m.breakEven)} note="If more claims than this are refunded, LPs lose money." />
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        With fair pricing p cancels out: r = 1 ÷ ((1 − tv·T/yr)(1 − fee)) − 1. The edge comes from the {bps(p.lpFeeBps)} fee and the time-value discount, not
        from the refund risk itself; the annualized figure is high only because the fee is earned over a {duration(T)} hold. It assumes capital is
        redeployed continuously, refunds arrive exactly at rate p, and ignores gas and idle time. Claims sold later in their window have a shorter T. The live
        demo windows are minutes long, so annualizing them would be meaningless.
      </p>
    </section>
  );
}

const Row = ({ k, v, note, strong }: { k: string; v: string; note?: string; strong?: boolean }) => (
  <div className="py-2">
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-charcoal">{k}</dt>
      <dd className={`shrink-0 text-right font-mono tabular ${strong ? "text-lg font-semibold text-ink" : ""}`}>{v}</dd>
    </div>
    {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
  </div>
);

function ClaimsTable({ p }: { p: PoolState }) {
  const claims = usePoolClaims(p.pool);
  const now = useNow();
  const all = claims.data ?? [];
  const [limit, setLimit] = useState(5);
  const rows = all.slice(0, limit);
  const a = p.brand.asset;
  return (
    <section aria-label={`Claims held by the ${a} pool`}>
      <h4 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">Claims bought by this pool</h4>
      {claims.isLoading ? (
        <p className="breathe mt-4 text-sm text-muted">Reading claims from chain…</p>
      ) : claims.isError ? (
        <p className="mt-4 text-sm text-vermilion-deep">Couldn&apos;t read claims from the RPC. Retrying automatically.</p>
      ) : !all.length ? (
        <p className="mt-4 text-sm text-muted">This pool has not bought any claims yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
              <tr className="border-b border-ink/20">
                <th className="py-2 pr-4 font-normal">Claim</th>
                <th className="py-2 pr-4 font-normal">Original claimant</th>
                <th className="py-2 pr-4 text-right font-normal">Face ({a})</th>
                <th className="py-2 pr-4 text-right font-normal">Cost ({a})</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 font-normal">Unlock / outcome</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((c) => (
                <ClaimRow key={c.id.toString()} c={c} now={now} />
              ))}
            </tbody>
          </table>
          {all.length > rows.length && (
            <button type="button" onClick={() => setLimit((l) => l + 10)} className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-ink underline decoration-vermilion underline-offset-4">
              Show more ({all.length - rows.length} older)
            </button>
          )}
          <p className="mt-2 text-xs text-muted">
            Book cost is stored onchain only while a claim is held. For resolved claims the pool&apos;s realized gains and losses above are the authoritative totals.
          </p>
        </div>
      )}
    </section>
  );
}

function ClaimRow({ c, now }: { c: LockedClaim & { cost: bigint }; now: number }) {
  const left = c.unlockAt - now;
  const locked = c.status === 1;
  return (
    <tr className="border-b border-ink/10 align-top">
      <td className="py-3 pr-4 font-mono">#{c.id.toString()}</td>
      <td className="py-3 pr-4 font-mono">
        <a className="ink-link" href={addressUrl(c.originalClaimant)} target="_blank" rel="noreferrer">
          {shortAddress(c.originalClaimant)}
        </a>
      </td>
      <td className="py-3 pr-4 text-right font-mono">{fmt(c.amount)}</td>
      <td className="py-3 pr-4 text-right font-mono">{c.cost > 0n ? fmt(c.cost) : "—"}</td>
      <td className="py-3 pr-4">
        {locked ? "Held · locked" : c.status === 3 ? "Settled" : c.status === 2 ? <span className="text-vermilion-deep">Voided</span> : "—"}
      </td>
      <td className="py-3 font-mono text-xs">
        {locked ? (
          left > 0 ? (
            <span>unlocks in {countdown(left)}</span>
          ) : (
            <SettleButton id={c.id} />
          )
        ) : c.status === 3 ? (
          c.cost > 0n ? (
            <span>settled · gain +{fmt(c.amount - c.cost)}</span>
          ) : (
            <span>settled</span>
          )
        ) : c.status === 2 ? (
          <span className="text-vermilion-deep">refunded (loss)</span>
        ) : null}
      </td>
    </tr>
  );
}

/** A matured claim waits for anyone to settle it; its capital stays locked until then. */
function SettleButton({ id }: { id: bigint }) {
  const tx = useTx();
  return (
    <div>
      <span>unlocked · awaiting settlement </span>
      <button className="ink-link font-semibold uppercase tracking-[0.12em] disabled:opacity-40" disabled={tx.busy} onClick={() => tx.send(settleRequest(id), `Settle #${id}`)}>
        {tx.busy ? "settling…" : "settle"}
      </button>
      <TxStatus tx={tx} />
    </div>
  );
}
