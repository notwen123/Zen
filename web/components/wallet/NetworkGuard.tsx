"use client";


import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAccount, useSwitchChain } from "@/lib/account";
import { Seal } from "@/components/art/Art";
import { Button } from "@/components/ui/Button";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { FAUCET_URL, monadTestnet } from "@/lib/chain";

/** Pages that only read public chain state render without a wallet (judges can browse them). */
const PUBLIC = ["/app/lp", "/app/brands"];

/** Gate for the app: connected wallet on Monad testnet, with graceful states otherwise. */
export function NetworkGuard({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { status, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [switchError, setSwitchError] = useState(false);

  if (status === "connecting")
    return <Panel title="Waiting for your passkey…" body="Approve the passkey prompt to derive your Monad account." quiet />;

  if (status !== "connected" && PUBLIC.some((p) => path === p || path.startsWith(p + "/"))) return <>{children}</>;

  if (status !== "connected")
    return (
      <Panel title="Sign in to continue." body="Sign in with a passkey (Face ID, Touch ID, Windows Hello, a phone or a security key). Zen derives your Monad account from it: no seed phrase, no extension, no custody.">
        <ConnectWallet />
      </Panel>
    );

  if (chainId !== monadTestnet.id)
    return (
      <Panel title="Zen runs on Monad testnet." body="Your wallet is on a different network. Switch to continue.">
        <Button
          disabled={isPending}
          onClick={async () => {
            setSwitchError(false);
            try {
              await switchChainAsync({ chainId: monadTestnet.id });
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
              ["Network", monadTestnet.name],
              ["RPC URL", monadTestnet.rpcUrls.default.http[0]],
              ["Chain ID", String(monadTestnet.id)],
              ["Currency", monadTestnet.nativeCurrency.symbol],
              ["Explorer", monadTestnet.blockExplorers.default.url],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-ink/10 py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="break-all text-right font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-6 text-sm text-muted">
          Need MON for gas?{" "}
          <a className="ink-link text-ink" href={FAUCET_URL} target="_blank" rel="noreferrer">
            Monad testnet faucet ↗
          </a>
        </p>
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
