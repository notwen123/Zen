import type { Metadata } from "next";
import Image from "next/image";
import { Reveal, RevealLines } from "@/components/motion/Motion";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";
import { GITHUB_URL } from "@/lib/chain";

export const metadata: Metadata = { title: "About", description: "Ownership should follow participation. The STOCKBACK manifesto." };

const CHAPTERS = [
  {
    t: "Why STOCKBACK exists",
    b: [
      "Every day people fund the brands they love: coffee in the morning, shoes for the season, a new phone every few years. That spending builds companies, but the customer keeps nothing except a receipt.",
      "STOCKBACK starts from a simple idea: an attested purchase can become a small stake in what you buy.",
    ],
  },
  {
    t: "The problem",
    b: [
      "Loyalty points are closed-loop, lose value and quietly expire. Crypto cashback usually pays in tokens unrelated to what you bought, and rarely proves the purchase happened, or happened only once.",
    ],
  },
  {
    t: "The protocol",
    b: [
      "Evidence stays off-chain. An attester signs a claim that contains only hashes. On-chain, one transaction checks the signature, burns a nullifier so the receipt can never count twice, applies eligibility and reward rules, and deposits shares into the brand's vault in your name.",
      "Evidence comes in tiers. A merchant-signed receipt is checked against the merchant's key before the attester signs, so no field can be changed after the sale; in this demo the merchant is simulated. A photo or typed receipt is only attested: the attester signs what it was given. Proof taken from the payment or order source itself is on the roadmap, not built.",
    ],
  },
  {
    t: "Why proof matters",
    b: [
      "Rewards without proof invite fraud; proof without limits invites abuse. STOCKBACK separates the two. A merchant signature shows a receipt is unaltered; a photo attestation does not show a purchase happened, and AI can now forge receipt photos convincingly. Caps and budgets bound what any wallet or brand can earn either way. We are explicit about the limits: a nullifier stops the same receipt counting twice, not someone with many wallets and many receipts.",
    ],
  },
  {
    t: "Why Stylus",
    b: [
      "Many services sign with Ed25519, which the EVM cannot verify natively. STOCKBACK verifies those signatures in Rust on Arbitrum Stylus. Measured on Robinhood Chain testnet, that costs 5 to 9 times less gas than the best Solidity implementation available, and 100 signatures fit in one transaction.",
    ],
  },
  {
    t: "Why tokenized ownership",
    b: [
      "A vault share is portable, composable and yours: no issuer can expire it or claw it back. On testnet the brand assets are simulated. In production, distributing exposure to tokenized equities would require issuer authorization and legal review, and the protocol is built so that compliance plugs in as an adapter.",
    ],
  },
  {
    t: "The long-term vision",
    b: [
      "A world where ownership follows participation: where the people who build a brand's revenue also share in its future, verified and without middlemen.",
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
              <RevealLines lines={["Ownership", "should follow", "participation."]} />
            </h1>
            <Reveal delay={0.4} className="mt-10 flex items-center gap-4 font-mono text-sm uppercase tracking-[0.22em]">
              <span>Evidence</span>
              <span className="text-vermilion">→</span>
              <span>Proof</span>
              <span className="text-vermilion">→</span>
              <span>Ownership</span>
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
              <span className="font-display text-5xl font-extrabold text-transparent [-webkit-text-stroke:1px_var(--stockback-ink)]" aria-hidden="true">
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
