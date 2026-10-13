"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { BrandMark } from "@/components/brand/BrandMark";
import { useAllClaims } from "@/components/hooks/useZen";
import { Button, Eyebrow } from "@/components/ui/Button";
import { monadTestnet } from "@/lib/chain";
import { classifyClaimError, getTransactionUrl, publicClient, shortAddress, units, voidRequest } from "@/lib/zen";

type Job = { id: bigint; s: "signing" | "wallet" | "pending" | "done" | "error"; hash?: Hex; error?: string };

const countdown = (s: number) => (s <= 0 ? "unlocked" : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

/** Simulated merchant refund desk: void a Locked claim before its return window closes. */
export function RefundDesk() {
  const claims = useAllClaims();
  const qc = useQueryClient();
  const { status, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [job, setJob] = useState<Job>();

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const locked = (claims.data ?? []).filter((c) => c.status === 1 && c.unlockAt > now).slice(0, 12);
  const busy = job && job.s !== "done" && job.s !== "error";

  async function refund(id: bigint) {
    if (status !== "connected") return openConnectModal?.();
    setJob({ id, s: "signing" });
    try {
      const res = await fetch("/api/merchant/refund", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ claimId: id.toString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't sign the refund");
      if (chainId !== monadTestnet.id) await switchChainAsync({ chainId: monadTestnet.id });
      setJob({ id, s: "wallet" });
      const hash = await writeContractAsync(voidRequest(id, body.refundRef, BigInt(body.deadline), body.signature));
      setJob({ id, s: "pending", hash });
      const rc = await publicClient.waitForTransactionReceipt({ hash });
      if (rc.status !== "success") throw new Error("The void transaction reverted.");
      setJob({ id, s: "done", hash });
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["pools"] });
    } catch (e) {
      const err = classifyClaimError(e);
      const msg = err.kind === "rejected" ? "You declined the transaction." : err.kind === "funds" ? "Your wallet needs testnet MON for gas." : err.kind === "other" ? err.detail : "The void was rejected.";
      setJob({ id, s: "error", error: msg });
    }
  }

  return (
    <section aria-labelledby="refund-title" className="mt-24 border-t border-ink/15 pt-12">
      <div className="border border-vermilion/50 bg-vermilion/5 px-4 py-3 text-sm text-vermilion-deep" role="note">
        <strong>Simulated merchant refund (demo).</strong> Anyone can trigger one here. In production the refund attester signs only after checking a merchant-signed refund
        receipt.
      </div>
      <Eyebrow className="mt-10">Refund desk · void path</Eyebrow>
      <h2 id="refund-title" className="mt-4 font-display text-[clamp(2rem,4.5vw,3.4rem)] font-extrabold leading-[1]">
        Issue refund.
      </h2>
      <p className="mt-5 max-w-2xl text-charcoal">
        A refund proven before unlock voids the claim: the escrowed equity returns to the sponsor and whoever holds the claim gets nothing. If the claimant already sold it,
        the LP pool holds it, so the refund is the pool&apos;s loss. That is the risk the instant-exit discount prices.
      </p>

      {job && (
        <p className={`mt-6 text-sm ${job.s === "error" ? "text-vermilion-deep" : "text-charcoal"}`} role="status" aria-live="polite">
          Claim #{job.id.toString()}:{" "}
          {job.s === "signing" ? "refund attester signing…" : job.s === "wallet" ? "confirm the void in your wallet…" : job.s === "pending" ? "voiding on Monad…" : job.s === "done" ? "voided. Escrow returned to the sponsor." : job.error}
          {job.hash && (
            <>
              {" "}
              <a className="ink-link" href={getTransactionUrl(job.hash)} target="_blank" rel="noreferrer">
                View on MonadVision ↗
              </a>
            </>
          )}
        </p>
      )}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">
            <tr className="border-b border-ink/15">
              <th className="py-3 pr-4 font-normal">Claim</th>
              <th className="py-3 pr-4 font-normal">Brand</th>
              <th className="py-3 pr-4 font-normal">Escrowed equity</th>
              <th className="py-3 pr-4 font-normal">Holder</th>
              <th className="py-3 pr-4 font-normal">Unlocks in</th>
              <th className="py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {locked.map((c) => {
              const lp = c.brand && c.holder.toLowerCase() === c.brand.exitPool.toLowerCase();
              return (
                <tr key={c.id.toString()} className="border-b border-ink/10 align-middle">
                  <td className="tabular py-3 pr-4 font-mono">#{c.id.toString()}</td>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2">
                      {c.brand && <BrandMark brand={c.brand} className="h-5 w-7" />}
                      {c.brand?.name ?? "Unknown"}
                    </span>
                  </td>
                  <td className="tabular py-3 pr-4">
                    {units(c.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {c.brand?.asset}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="font-mono text-xs">{shortAddress(c.holder)}</span>
                    {lp && <span className="mt-0.5 block text-xs text-vermilion-deep">held by LP pool — refund = LP loss</span>}
                  </td>
                  <td className="tabular py-3 pr-4 font-mono text-xs">
                    {countdown(c.unlockAt - now)}
                    {c.demoWindow && <span className="ml-1 text-muted">(demo window)</span>}
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="ghost" className="min-h-9 px-4 py-2" disabled={!!busy} onClick={() => refund(c.id)}>
                      {busy && job?.id === c.id ? "Refunding…" : "Issue refund"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {claims.isPending && <p className="breathe mt-6 text-sm text-muted">Reading claims from Monad testnet…</p>}
        {claims.isError && <p className="mt-6 text-sm text-vermilion-deep">Couldn&apos;t read claims from Monad testnet. Retrying shortly.</p>}
        {claims.isSuccess && !locked.length && (
          <p className="mt-6 text-sm text-muted">No claims are inside their return window right now. Issue a receipt above and claim it to create one.</p>
        )}
      </div>
    </section>
  );
}
