"use client";

import Link from "next/link";
import { useAccount } from "@/lib/account";
import { useActivity, useClaims } from "@/components/hooks/useZen";
import { claimState, countdown, useNow } from "@/components/claims/LockedEquity";
import { SealProgress } from "@/components/claims/SealProgress";
import { ActivityTimeline, ScanLink } from "@/components/ownership/Ownership";
import { BrandMark } from "@/components/brand/BrandMark";
import { units, type LockedClaim } from "@/lib/zen";

const fmt = (v: bigint) => units(v).toLocaleString("en-US", { maximumFractionDigits: 4 });
const greeting = () => {
  const h = new Date().getHours();
  return h < 5 || h >= 17 ? "Good evening" : h < 12 ? "Good morning" : "Good afternoon";
};

/** The single most useful thing to do next: settle what's unlocked, else the claim that unlocks soonest. */
function nextClaim(claims: LockedClaim[], now: number) {
  const locked = claims.filter((c) => claimState(c) === "locked");
  return locked.find((c) => c.unlockAt <= now) ?? [...locked].sort((a, b) => a.unlockAt - b.unlockAt)[0];
}

export default function Home() {
  const { address } = useAccount();
  const claims = useClaims(address);
  const activity = useActivity(address);
  const now = useNow();
  const all = claims.data ?? [];
  const next = nextClaim(all, now);
  const lockedTotal = all.filter((c) => claimState(c) === "locked").reduce((s, c) => s + units(c.amount), 0);
  const counts = { locked: 0, cashed: 0, settled: 0, voided: 0 };
  for (const c of all) counts[claimState(c)]++;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-4xl font-bold sm:text-5xl" suppressHydrationWarning>
        {greeting()}.
      </h1>

      {/* The one thing to do now. */}
      <section aria-label="Next up" className="mt-8">
        {claims.isLoading ? (
          <div className="breathe h-56 bg-[#FBF8F1]" aria-label="Loading your claims" role="status" />
        ) : next ? (
          <div className="grid gap-8 bg-[#FBF8F1] p-7 shadow-[0_30px_60px_-45px_rgba(23,23,23,.6)] sm:p-9 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-sm text-muted">{next.unlockAt <= now ? "Ready for you" : "Unlocking next"}</p>
              <div className="mt-3 flex items-center gap-4">
                {next.brand && <BrandMark brand={next.brand} className="h-10 w-14" />}
                <p className="font-display text-4xl font-bold tabular sm:text-5xl">
                  {fmt(next.amount)} <span className="text-2xl">{next.brand?.asset}</span>
                </p>
              </div>
              <SealProgress start={next.mintedAt} end={next.unlockAt} now={now} state="locked" />
            </div>
            <div className="flex flex-col justify-center gap-3 border-ink/10 lg:border-l lg:pl-8">
              {next.unlockAt <= now ? (
                <>
                  <p className="text-sm text-charcoal">The return window has closed. Settle to move the equity into your wallet.</p>
                  <Link href="/app/portfolio" className="ink-btn bg-ink px-5 py-3 text-center text-sm font-semibold text-paper">
                    Settle claim #{next.id.toString()}
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-charcoal">
                    Wait <span className="font-mono tabular text-ink">{countdown(next.unlockAt - now)}</span> for the full amount, or take{" "}
                    <span className="font-mono tabular text-ink">
                      {fmt(next.quote)} {next.brand?.asset}
                    </span>{" "}
                    now.
                  </p>
                  <Link href="/app/portfolio" className="ink-btn bg-ink px-5 py-3 text-center text-sm font-semibold text-paper">
                    Cash out or wait
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid items-center gap-8 bg-[#FBF8F1] p-7 sm:p-9 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="font-display text-3xl font-bold">{all.length ? "Nothing waiting on you." : "Turn your next receipt into equity."}</p>
              <p className="mt-3 text-charcoal">
                {all.length
                  ? "Every claim you have is resolved. Scan another receipt to start a new one."
                  : "Scan a merchant receipt. The reward is locked while the purchase can still be returned, then it's yours."}
              </p>
            </div>
            <div className="lg:justify-self-end">
              <ScanLink label={all.length ? "Scan another receipt" : "Scan your first receipt"} />
            </div>
          </div>
        )}
      </section>

      {/* How a reward moves: a real sequence, so it is numbered. */}
      <ol className="mt-10 grid gap-6 text-sm sm:grid-cols-3">
        {[
          ["Scan", "A merchant-signed receipt proves the purchase."],
          ["Locked", "The reward is escrowed until the return window closes."],
          ["Cash out or settle", "Sell it to a pool now, or wait and receive it in full."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/30 font-display text-sm">{i + 1}</span>
            <span>
              <span className="block font-semibold">{t}</span>
              <span className="text-charcoal">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {all.length > 0 && (
        <dl className="mt-10 grid grid-cols-2 gap-6 border-y border-ink/10 py-6 sm:grid-cols-5">
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-xs text-muted">Locked now</dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular">₹{lockedTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</dd>
          </div>
          {(["locked", "cashed", "settled", "voided"] as const).map((k) => (
            <div key={k}>
              <dt className="text-xs text-muted">{{ locked: "Locked", cashed: "Cashed out", settled: "Settled", voided: "Refunded" }[k]}</dt>
              <dd className="mt-1 font-mono text-lg tabular">{counts[k]}</dd>
            </div>
          ))}
        </dl>
      )}

      {address && (activity.data?.length ?? 0) > 0 && (
        <section aria-labelledby="recent" className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 id="recent" className="font-display text-2xl font-bold">
              Recent
            </h2>
            <Link href="/app/activity" className="ink-link text-sm">
              All activity
            </Link>
          </div>
          <div className="mt-4">
            <ActivityTimeline items={activity.data!} limit={3} />
          </div>
        </section>
      )}
    </div>
  );
}
