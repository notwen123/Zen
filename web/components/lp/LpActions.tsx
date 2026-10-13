"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BaseError, formatUnits, parseUnits, type Address, type Hex } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { Button } from "@/components/ui/Button";
import {
  approveEquityRequest,
  classifyClaimError,
  depositRequest,
  getTransactionUrl,
  units,
  withdrawRequest,
  type PoolState,
} from "@/lib/zen";

export const fmt = (v: bigint, max = 4) => units(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: max });

type WriteRequest = Parameters<ReturnType<typeof useWriteContract>["writeContractAsync"]>[0];

/** One write at a time: wallet signature, then receipt; every LP-facing query is refetched once it confirms. */
export function useTx() {
  const qc = useQueryClient();
  const { writeContractAsync, isPending: signing } = useWriteContract();
  const [hash, setHash] = useState<Hex>();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string>();
  const receipt = useWaitForTransactionReceipt({ hash });
  const status = receipt.data?.status;

  useEffect(() => {
    if (status !== "success") return;
    for (const key of ["pools", "poolClaims", "claims", "portfolio"]) qc.invalidateQueries({ queryKey: [key], refetchType: "all" });
  }, [status, qc]);

  async function send(req: WriteRequest, what: string) {
    setError(undefined);
    setHash(undefined);
    setLabel(what);
    try {
      setHash(await writeContractAsync(req));
    } catch (e) {
      const c = classifyClaimError(e);
      setError(
        c.kind === "rejected"
          ? "You rejected the request in your wallet."
          : c.kind === "funds"
            ? "Not enough MON for gas. Monad bills the full gas limit; top up from the faucet."
            : e instanceof BaseError
              ? e.shortMessage
              : c.kind === "other"
                ? c.detail
                : "Transaction failed.",
      );
    }
  }

  const busy = signing || (!!hash && receipt.isLoading);
  return { send, busy, signing, hash, label, error, receipt };
}

export function TxStatus({ tx }: { tx: ReturnType<typeof useTx> }) {
  const { signing, hash, label, error, receipt } = tx;
  if (error) return <p className="mt-3 text-xs text-vermilion-deep" role="alert">{error}</p>;
  if (signing) return <p className="breathe mt-3 font-mono text-xs text-muted">{label}: confirm in your wallet…</p>;
  if (!hash) return null;
  const state = receipt.isLoading
    ? "pending"
    : receipt.data?.status === "success"
      ? "confirmed"
      : receipt.data?.status === "reverted"
        ? "reverted"
        : receipt.isError
          ? "receipt unavailable"
          : "pending";
  return (
    <p className={`mt-3 font-mono text-xs ${state === "reverted" ? "text-vermilion-deep" : "text-charcoal"}`} role="status">
      {label} · {state}{" "}
      <a className="ink-link" href={getTransactionUrl(hash)} target="_blank" rel="noreferrer">
        view on explorer ↗
      </a>
    </p>
  );
}

/** Deposit / withdraw the pool's equity token for the connected wallet. */
export function LpActions({ p, address }: { p: PoolState; address: Address }) {
  const tx = useTx();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [input, setInput] = useState("");
  const u = p.user;
  const asset = p.brand.asset;
  const max = mode === "deposit" ? (u?.equityBalance ?? 0n) : (u?.maxWithdraw ?? 0n);

  let amount = 0n;
  let invalid: string | undefined;
  if (input) {
    try {
      amount = parseUnits(input, 18);
      if (amount <= 0n) invalid = "Enter an amount above zero.";
      else if (amount > max) invalid = mode === "deposit" ? `Exceeds your ${asset} balance.` : "Exceeds the withdrawable amount.";
    } catch {
      invalid = "Enter a number, up to 18 decimals.";
    }
  }
  const needsApproval = mode === "deposit" && amount > 0n && (u?.allowance ?? 0n) < amount;
  const ready = !!u && amount > 0n && !invalid && !tx.busy;
  const lockedShare = u && u.assets > u.maxWithdraw ? u.assets - u.maxWithdraw : 0n;

  function submit() {
    if (!ready) return;
    if (mode === "withdraw") return tx.send(withdrawRequest(p.pool, amount, address), `Withdraw ${input} ${asset}`);
    if (needsApproval) return tx.send(approveEquityRequest(p.brand.equity, p.pool, amount), `Approve ${input} ${asset}`);
    tx.send(depositRequest(p.pool, amount, address), `Deposit ${input} ${asset}`);
  }

  return (
    <section aria-label={`Your ${asset} LP position`} className="border-t border-ink/15 pt-6">
      <h4 className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">Your position</h4>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Stat k={`Wallet ${asset}`} v={u ? fmt(u.equityBalance) : "—"} />
        <Stat k="LP shares" v={u ? Number(formatUnits(u.shares, 24)).toLocaleString("en-IN", { maximumFractionDigits: 4 }) : "—"} />
        <Stat k={`Share value (${asset})`} v={u ? fmt(u.assets) : "—"} />
        <Stat k="Max withdrawable" v={u ? fmt(u.maxWithdraw) : "—"} />
      </dl>
      {lockedShare > 0n && (
        <p className="mt-3 text-xs text-charcoal">
          {fmt(lockedShare)} {asset} of your value is not withdrawable right now: withdrawals are paid only from idle assets, and the rest of the pool is
          locked in claims until they settle or are refunded.
        </p>
      )}
      {u && u.equityBalance === 0n && u.shares === 0n && (
        <p className="mt-4 border-l-2 border-gold pl-4 text-xs leading-relaxed text-charcoal">
          Your wallet holds no {asset}. Mock equity is a testnet token: it cannot be bought anywhere and has no value. You receive it by earning
          stock-back: when one of your claims settles after its return window, the {asset} is paid to your wallet, and you can deposit it here.
        </p>
      )}

      <div className="mt-6 flex gap-6 text-xs font-semibold uppercase tracking-[0.18em]">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            className={`border-b-[1.5px] pb-1 ${mode === m ? "border-vermilion text-ink" : "border-transparent text-muted hover:text-ink"}`}
            onClick={() => {
              setMode(m);
              setInput("");
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex flex-wrap items-start gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="flex min-w-0 flex-1 basis-56 items-center border border-ink/40 bg-[#FBF8F1] focus-within:border-ink">
          <span className="sr-only">{mode === "deposit" ? "Deposit" : "Withdraw"} amount in {asset}</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={input}
            onChange={(e) => setInput(e.target.value.trim())}
            aria-invalid={!!invalid}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 font-mono text-lg tabular outline-none"
          />
          <span className="px-2 font-mono text-xs text-muted">{asset}</span>
          <button
            type="button"
            className="h-full border-l border-ink/20 px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] hover:text-vermilion disabled:opacity-40"
            disabled={max === 0n}
            onClick={() => setInput(formatUnits(max, 18))}
          >
            Max
          </button>
        </label>
        <Button type="submit" disabled={!ready}>
          {tx.busy ? "Working…" : mode === "withdraw" ? "Withdraw" : needsApproval ? `Approve ${asset}` : "Deposit"}
        </Button>
      </form>
      {invalid && <p className="mt-2 text-xs text-vermilion-deep">{invalid}</p>}
      {needsApproval && !invalid && (
        <p className="mt-2 text-xs text-muted">Step 1 of 2: allow the pool to pull exactly {input} {asset}. Then deposit.</p>
      )}
      {mode === "withdraw" && (
        <p className="mt-2 text-xs text-muted">
          Withdrawable = min(your share value, pool idle assets). Idle now: {fmt(p.idle)} {asset}.
        </p>
      )}
      <TxStatus tx={tx} />
    </section>
  );
}

export const Stat = ({ k, v, tone }: { k: string; v: string; tone?: "gain" | "loss" }) => (
  <div>
    <dt className="text-xs text-muted">{k}</dt>
    <dd className={`mt-1 font-mono text-base tabular ${tone === "loss" ? "text-vermilion-deep" : "text-ink"}`}>{v}</dd>
  </div>
);
