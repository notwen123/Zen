"use client";

import { useState, type ReactNode } from "react";
import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { useRouter } from "next/navigation";
import { useMotionPref } from "@/app/providers";
import { useVerifier } from "@/components/hooks/useZen";
import { Button } from "@/components/ui/Button";
import { addressUrl, FAUCET_URL, monadTestnet } from "@/lib/chain";
import { BRANDS } from "@/lib/brands";
import { contracts } from "@/lib/contracts";
import { shortAddress } from "@/lib/zen";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-ink/15 py-10 md:grid-cols-[220px_1fr]" aria-label={title}>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 border-b border-ink/10 py-3 text-sm">
    <span className="text-muted">{k}</span>
    <span className="break-all text-right font-mono text-xs">{v}</span>
  </div>
);

const CONTRACT_ROWS: [string, string][] = [
  ["ConditionalClaim", contracts.conditionalClaim],
  ["VoidOracle", contracts.voidOracle],
  ["Registry", contracts.registry],
  ["ECDSA verifier", contracts.ecdsaVerifier],
  ["Eligibility policy", contracts.eligibilityPolicy],
  ["Reward policy", contracts.rewardPolicy],
  ["Reward pool", contracts.rewardPool],
  ["Brand vault factory", contracts.factory],
  ["AUSD reward adapter", contracts.ausdAdapter],
  ...BRANDS.map((b): [string, string] => [`${b.name} exit pool (${b.asset})`, b.exitPool]),
];

export default function Settings() {
  const { address, chainId, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const router = useRouter();
  const { pref, setPref } = useMotionPref();
  const { data: verifier } = useVerifier();
  const [copied, setCopied] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-8 font-display text-4xl font-bold sm:text-5xl">Settings</h1>

      <Section title="Wallet">
        <Row k="Connected wallet" v={address ? <a className="ink-link" href={addressUrl(address)} target="_blank" rel="noreferrer">{shortAddress(address)} ↗</a> : "—"} />
        <Row k="Connector" v={connector?.name ?? "—"} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            variant="ghost"
            onClick={async () => {
              if (!address) return;
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy address"}
          </Button>
          <Button
            onClick={() => {
              disconnect();
              router.push("/");
            }}
          >
            Disconnect wallet
          </Button>
        </div>
      </Section>

      <Section title="Network">
        <Row k="Network" v={monadTestnet.name} />
        <Row k="Chain ID" v={`${chainId ?? "—"}${chainId === monadTestnet.id ? " ✓" : ""}`} />
        <Row k="RPC" v={monadTestnet.rpcUrls.default.http[0]} />
        <Row k="Explorer" v={<a className="ink-link" href={monadTestnet.blockExplorers.default.url} target="_blank" rel="noreferrer">{monadTestnet.blockExplorers.default.url} ↗</a>} />
        <div className="mt-6 flex flex-wrap gap-3">
          {chainId !== monadTestnet.id && <Button onClick={() => switchChain({ chainId: monadTestnet.id })}>Switch network</Button>}
          <a className="ink-link self-center text-sm" href={FAUCET_URL} target="_blank" rel="noreferrer">
            Get testnet MON ↗
          </a>
        </div>
      </Section>

      <Section title="Preferences">
        <fieldset>
          <legend className="text-sm text-charcoal">Motion</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {(["system", "reduced"] as const).map((p) => (
              <label key={p} className={`cursor-pointer border px-4 py-2 text-sm ${pref === p ? "border-ink bg-ink text-paper" : "border-ink/25"}`}>
                <input type="radio" name="motion" value={p} checked={pref === p} onChange={() => setPref(p)} className="sr-only" />
                {p === "system" ? "Follow system" : "Reduce motion"}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="Protocol">
        <Row k="EIP-712 domains" v="“Zen”/“1” (claims) · “Zen VoidOracle”/“1” (refunds)" />
        <Row
          k="Active verifier"
          v={verifier ? <a className="ink-link" href={addressUrl(verifier.address)} target="_blank" rel="noreferrer">{verifier.kind === "ecdsa" ? "ECDSA" : "Unknown"} · {shortAddress(verifier.address)} ↗</a> : "—"}
        />
        {CONTRACT_ROWS.map(([k, a]) => (
          <Row key={k} k={k} v={<a className="ink-link" href={addressUrl(a)} target="_blank" rel="noreferrer">{shortAddress(a)} ↗</a>} />
        ))}
      </Section>

      <Section title="Testnet">
        <p className="max-w-xl text-sm leading-relaxed text-charcoal">
          Zen is running on Monad testnet with mock tokenized-equity tokens (mNKE, mAAPL, mSBUX) and a mock AUSD. They are not securities, have no
          monetary value and no affiliation with the brands named. Return windows are short, labelled demo windows (5–10 minutes) instead of the
          14–30 days a production program would use. The attester is a demo service: it signs the receipt details you confirm and does not contact
          merchants or payment networks, and the merchant refund desk is simulated. Rewards are bounded on-chain by per-claim and daily caps.
        </p>
      </Section>
    </div>
  );
}
