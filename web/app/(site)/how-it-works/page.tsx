import type { Metadata } from "next";
import Image from "next/image";
import { Reveal, RevealLines } from "@/components/motion/Motion";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";

export const metadata: Metadata = { title: "How it works", description: "Ten stages from a paper receipt to on-chain ownership." };

// Each stage: what the user experiences, and what actually happens.
const STAGES = [
  { t: "Purchase", u: "You buy something from a supported brand, as you always do.", tech: "Nothing on-chain yet. STOCKBACK never touches the payment.", icon: "M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0" },
  { t: "Evidence", u: "You scan the merchant's signed QR, or photograph a paper receipt.", tech: "Tier 1: a merchant-signed receipt (Ed25519 over every field; simulated merchant in this demo). Tier 2: tesseract.js OCR in the browser, every field editable, so authenticity is not established.", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { t: "Attestation", u: "The attester checks the evidence and signs a claim.", tech: "For merchant receipts the attester first verifies the merchant signature, expiry and prior use. It then signs the EIP-712 digest with Ed25519 (Stylus verifier) or ECDSA. Keys never reach the browser.", icon: "M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z" },
  { t: "Commitment", u: "Your purchase becomes a fingerprint with no personal data.", tech: "claimId = EIP-712 hash of claimant, brand, merchant hash, salted receipt hash, amount, currency, time and deadline.", icon: "M8 8h8v8H8zM4 12h4M16 12h4M12 4v4M12 16v4" },
  { t: "Nullifier", u: "The receipt can only ever be used once, by anyone.", tech: "nullifier = keccak256(tag, merchantId, receiptHash). Independent of wallet and amount, so re-issuing a receipt doesn't help.", icon: "M5 5l14 14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" },
  { t: "Verification", u: "The signature is checked on-chain.", tech: "ReceiptCommitmentRegistry calls IReceiptVerifier.verify(digest, attestation). The active verifier is a Rust contract on Arbitrum Stylus checking strict Ed25519.", icon: "M5 12l4 4 10-10" },
  { t: "Eligibility", u: "Brand, currency, amount and date must fit the program.", tech: "EligibilityPolicy: brand active, INR, ₹100 to ₹5,00,000, purchase within 30 days and not in the future; optional jurisdiction adapter.", icon: "M4 6h16M7 12h10M10 18h4" },
  { t: "Reward", u: "Your reward is calculated by public rules.", tech: "RewardPolicy: amount × rate × multiplier, clipped to the per-claim cap; per-wallet and per-brand daily caps; paid only from sponsor budget.", icon: "M12 3v18M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" },
  { t: "Brand vault", u: "The reward goes into that brand's vault, in your name.", tech: "RewardPool deposits the brand asset into its admin-less ERC-4626 BrandVault and mints shares to you. Steps 4 to 9 are one transaction.", icon: "M4 10h16v10H4zM2 10l10-6 10 6" },
  { t: "Ownership", u: "You hold shares you control. Redeem them any time.", tech: "Portfolio reads vault balances live; activity reads registry events. Nobody but you can move your shares.", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

export default function HowItWorksPage() {
  return (
    <div>
      <header className="relative isolate overflow-hidden">
        <Image src="/art/panel.webp" alt="" width={160} height={365} className="float absolute right-[8%] top-16 -z-10 hidden h-auto w-28 lg:block" />
        <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-24 sm:px-8">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-6 font-display text-[clamp(2.8rem,7vw,6rem)] font-extrabold leading-[0.96]">
            <RevealLines lines={["From receipt", "to ownership,", "in ten stages."]} />
          </h1>
          <p className="mt-8 max-w-xl text-lg text-charcoal">Each stage in plain words, and what actually happens underneath.</p>
        </div>
      </header>

      <ol className="mx-auto max-w-[1320px] px-5 pb-24 sm:px-8">
        {STAGES.map((s, i) => (
          <Reveal as="li" key={s.t}>
            <div className="grid items-start gap-6 border-t border-ink/15 py-12 md:grid-cols-[90px_80px_1fr_1.1fr] md:gap-10">
              <span className="font-mono text-sm text-vermilion">{String(i + 1).padStart(2, "0")}</span>
              <span className={`grid h-16 w-16 place-items-center rounded-full border ${i === 5 ? "border-vermilion bg-vermilion text-paper" : "border-ink/60"}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                  <path className="draw" style={{ ["--len" as string]: 90, ["--dur" as string]: "1200ms" }} d={s.icon} />
                </svg>
              </span>
              <div>
                <h2 className="font-display text-3xl font-bold">{s.t}</h2>
                <p className="mt-3 text-lg leading-relaxed text-charcoal">{s.u}</p>
              </div>
              <p className="border-l border-ink/20 pl-5 font-mono text-[0.8rem] leading-relaxed text-muted">{s.tech}</p>
            </div>
          </Reveal>
        ))}
      </ol>

      <div className="border-t border-ink/15 bg-paper-dark/40">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-8 px-5 py-20 sm:px-8">
          <p className="max-w-xl font-display text-3xl font-bold leading-tight">Try it with a demo receipt. It takes under a minute, on real testnet.</p>
          <ButtonLink href="/app/scan">
            Scan a receipt <Arrow />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
