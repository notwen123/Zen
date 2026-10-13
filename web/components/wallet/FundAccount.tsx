"use client";

import { refreshAfterTx } from "@/lib/refresh";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { usePasskeyAccount } from "@/lib/account";
import { FAUCET_DRIP_MON, FAUCET_URL, txUrl } from "@/lib/chain";
import { publicClient } from "@/lib/zen";

/** Testnet-only: a new passkey account starts with 0 MON; this asks the server faucet for a small drip. */
export function FundAccount({ compact = false }: { compact?: boolean }) {
  const { address } = usePasskeyAccount();
  const qc = useQueryClient();
  const bal = useQuery({ queryKey: ["mon", address], queryFn: () => publicClient.getBalance({ address: address! }), enabled: !!address, refetchInterval: 15_000 });
  const [state, setState] = useState<{ busy?: boolean; msg?: string; hash?: string }>({});
  if (!address) return null;
  const low = bal.data !== undefined && bal.data < parseEther(FAUCET_DRIP_MON) / 2n;

  async function fund() {
    setState({ busy: true });
    try {
      const r = await fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
      const body = await r.json();
      if (!r.ok) return setState({ msg: body.error });
      await publicClient.waitForTransactionReceipt({ hash: body.hash });
      refreshAfterTx(qc, ["mon"]);
      setState({ msg: `Sent ${body.amount} test MON.`, hash: body.hash });
    } catch (e) {
      setState({ msg: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className={compact ? "mt-2 text-xs" : "border border-ink/15 bg-paper-dark/40 p-4 text-sm"}>
      <p className="font-mono">{bal.data === undefined ? "…" : `${Number(formatEther(bal.data)).toFixed(4)} MON`}</p>
      {low && !state.hash && (
        <button type="button" disabled={state.busy} onClick={fund} className="mt-2 border border-vermilion px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-vermilion-deep hover:bg-vermilion hover:text-paper disabled:opacity-50">
          {state.busy ? "Funding…" : `Fund my account (${FAUCET_DRIP_MON} test MON)`}
        </button>
      )}
      <p aria-live="polite" className="mt-1 text-muted">
        {state.msg}{" "}
        {state.hash && (
          <a className="ink-link" href={txUrl(state.hash)} target="_blank" rel="noreferrer">
            tx ↗
          </a>
        )}
        {low && !state.msg && !state.hash && (
          <>
            Testnet only. Or use{" "}
            <a className="ink-link" href={FAUCET_URL} target="_blank" rel="noreferrer">
              faucet.monad.xyz
            </a>
            .
          </>
        )}
      </p>
    </div>
  );
}
