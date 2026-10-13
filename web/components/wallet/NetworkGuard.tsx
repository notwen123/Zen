"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { Seal } from "@/components/art/Art";
import { Button } from "@/components/ui/Button";
import { robinhoodTestnet } from "@/lib/chain";

/** Gate for the app: connected wallet on Robinhood Chain testnet, with graceful states otherwise. */
export function NetworkGuard({ children }: { children: ReactNode }) {
  const { status, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [switchError, setSwitchError] = useState(false);

  if (status === "connecting" || status === "reconnecting")
    return <Panel title="Opening your ledger…" body="Reconnecting to your wallet." quiet />;

  if (status !== "connected")
    return (
      <Panel title="Connect to continue." body="STOCKBACK reads your ownership directly from Robinhood Chain testnet. Connect a wallet to see it.">
        <Button onClick={() => openConnectModal?.()}>Connect wallet</Button>
      </Panel>
    );

  if (chainId !== robinhoodTestnet.id)
    return (
      <Panel title="STOCKBACK runs on Robinhood Chain testnet." body="Your wallet is on a different network. Switch to continue.">
        <Button
          disabled={isPending}
          onClick={async () => {
            setSwitchError(false);
            try {
              await switchChainAsync({ chainId: robinhoodTestnet.id });
            } catch {
              setSwitchError(true);
            }
          }}
        >
          {isPending ? "Switching…" : "Switch network"}
        </Button>
        {switchError && (
          <dl className="mt-8 w-full max-w-sm border-t border-ink/15 pt-6 text-left text-sm">
            <p className="mb-4 text-charcoal">Your wallet couldn&apos;t switch automatically. Add the network manually:</p>
            {[
              ["Network", robinhoodTestnet.name],
              ["RPC URL", robinhoodTestnet.rpcUrls.default.http[0]],
              ["Chain ID", String(robinhoodTestnet.id)],
              ["Currency", "ETH"],
              ["Explorer", robinhoodTestnet.blockExplorers.default.url],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-ink/10 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="break-all text-right font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>
    );

  return <>{children}</>;
}

function Panel({ title, body, children, quiet }: { title: string; body: string; children?: ReactNode; quiet?: boolean }) {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="flex max-w-lg flex-col items-center text-center">
        <Seal size={44} className={quiet ? "breathe" : ""} />
        <h1 className="mt-8 font-display text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-charcoal">{body}</p>
        {children && <div className="mt-8 flex flex-col items-center">{children}</div>}
      </div>
    </div>
  );
}
