import type { Metadata } from "next";
import Image from "next/image";
import { Reveal, RevealLines } from "@/components/motion/Motion";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";
import { GITHUB_URL } from "@/lib/chain";

export const metadata: Metadata = {
  title: "About",
  description: "Every stock-back reward is a conditional equity claim. Zen makes it tradeable and prices consumer refund risk on Monad.",
};

const CHAPTERS = [
  {
    t: "Why Zen exists",
    b: [
      "Every stock-back reward is a locked, conditional equity claim, because the purchase can be refunded. Until the return window closes, the reward isn't really yours: it can still disappear.",
      "Zen makes that claim a tradeable asset and creates the first onchain market that prices consumer refund risk, settled on Monad.",
    ],
  },
  {
    t: "The problem",
    b: [
      "Stock-back programs either pay out at once and eat the refunds, or make customers wait weeks for something they can't use. Loyalty points dodge the question by being closed-loop and expiring. Nobody prices the risk in between.",
    ],
  },
  {
    t: "The claim",
    b: [
      "A verified purchase mints a conditional claim: an ERC-721 that escrows the reward in (mock) tokenized equity and is locked until the purchase's return window closes. On testnet those windows are labelled 5 to 10 minute demo windows; in production they would be 14 to 30 days.",
      "From there, one of three things happens. A refund proven before unlock voids the claim and the escrow returns to the sponsor. After unlock, anyone can settle it and the equity goes to whoever holds the claim. Or, at any point in between, the holder can sell it.",
    ],
  },
  {
    t: "The market",
    b: [
      "Each brand has an instant-exit pool. Liquidity providers deposit the equity token; a shopper holding a locked claim can sell it to the pool immediately, at a discount that prices the chance of a refund (per category, and higher for wallets with a history of voids), the time left to unlock, and an LP fee.",
      "If the claim settles, the pool earns the discount. If the purchase is refunded, the pool loses what it paid. That is a market for consumer refund risk, with every price and outcome on-chain.",
    ],
  },
  {
    t: "Why proof matters",
    b: [
      "Rewards without proof invite fraud; proof without limits invites abuse. Zen separates the two. A merchant signature shows a receipt is unaltered; a photo attestation does not show a purchase happened, and AI can now forge receipt photos convincingly. Caps and budgets bound what any wallet or brand can earn either way. A nullifier stops the same receipt counting twice, and a refund reference stops one refund voiding two claims, but neither stops someone with many wallets and many receipts.",
    ],
  },
  {
    t: "Why Monad",
    b: [
      "An instant exit only means something if it is instant. Monad's sub-second finality makes the sale final about as fast as the wallet confirms it, and its low fees make it practical to mint, sell, void and settle every claim on its own instead of batching. It is plain EVM: Solidity contracts, EIP-712 attestations verified with ECDSA.",
    ],
  },
  {
    t: "What is real, and what is not",
    b: [
      "The contracts, claims, pools, voids and settlements are real and live on Monad testnet. The equity tokens are mocks: not securities, with no affiliation to the brands named. The merchant is simulated. In production, distributing exposure to tokenized equities would require issuer authorization and legal review.",
    ],
  },
];

export default function About() {
  return (
    <article>
      <header className="relative isolate overflow-hidden">
        <div className="mx-auto grid max-w-[1320px] items-center gap-12 px-5 py-24 sm:px-8 md:grid-cols-[1.3fr_1fr] md:py-32">
          <div>
            <Eyebrow>Manifesto</Eyebrow>
            <h1 className="mt-6 font-display text-[clamp(3rem,8vw,6.6rem)] font-extrabold leading-[0.95]">
              <RevealLines lines={["Rewards are", "claims. Claims", "can trade."]} />
            </h1>
            <Reveal delay={0.4} className="mt-10 flex items-center gap-4 font-mono text-sm uppercase tracking-[0.22em]">
              <span>Purchase</span>
              <span className="text-vermilion">→</span>
              <span>Claim</span>
              <span className="text-vermilion">→</span>
              <span>Sell · Void · Settle</span>
            </Reveal>
          </div>
          <Reveal delay={0.2} className="mx-auto w-full max-w-[340px]">
            <Image src="/art/koi-waves-alpha.webp" alt="Two koi leaping over red waves beneath a vermilion sun" width={368} height={543} className="h-auto w-full" priority />
          </Reveal>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-5 pb-32 sm:px-8">
        {CHAPTERS.map((c, i) => (
          <Reveal key={c.t}>
            <section className="grid gap-6 border-t border-ink/15 py-14 md:grid-cols-[120px_1fr_1.6fr] md:gap-10">
              <span className="font-display text-5xl font-extrabold text-transparent [-webkit-text-stroke:1px_var(--zen-ink)]" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="font-display text-3xl font-bold leading-tight">{c.t}</h2>
              <div className="space-y-4 text-lg leading-relaxed text-charcoal">
                {c.b.map((p) => (
                  <p key={p.slice(0, 20)}>{p}</p>
                ))}
              </div>
            </section>
          </Reveal>
        ))}
        <Reveal className="mt-8 flex flex-wrap gap-4 border-t border-ink/15 pt-12">
          <ButtonLink href="/how-it-works">
            See how it works <Arrow />
          </ButtonLink>
          <ButtonLink href={`${GITHUB_URL}#readme`} external variant="ghost">
            Read the protocol
          </ButtonLink>
        </Reveal>
      </div>
    </article>
  );
}
