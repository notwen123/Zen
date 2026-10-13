import type { Metadata } from "next";
import Image from "next/image";
import { Reveal, RevealLines } from "@/components/motion/Motion";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";

export const metadata: Metadata = { title: "How it works", description: "Ten stages from a receipt to a conditional equity claim that you can hold, sell, or see voided by a refund." };

// Each stage: what the user experiences, and what actually happens.
const STAGES = [
  { t: "Purchase", u: "You buy something from a supported brand, as you always do.", tech: "Nothing on-chain yet. Zen never touches the payment.", icon: "M6 7h12l-1 13H7zM9 7a3 3 0 0 1 6 0" },
  { t: "Evidence", u: "You scan the merchant's signed QR, or photograph a paper receipt.", tech: "Tier 1: a merchant-signed receipt (Ed25519 over every field, checked off-chain; simulated merchant in this demo). Tier 2: tesseract.js OCR in the browser, every field editable, so authenticity is not established.", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6" },
  { t: "Attestation", u: "The attester checks the evidence and signs a claim.", tech: "For merchant receipts the attester first verifies the merchant signature, expiry and prior use. It then signs the EIP-712 digest with ECDSA. Keys never reach the browser.", icon: "M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z" },
  { t: "Commitment", u: "Your purchase becomes a fingerprint with no personal data.", tech: "claimId = EIP-712 hash of claimant, brand, merchant hash, salted receipt hash, amount, currency, time and deadline. A nullifier keyed on merchant and receipt makes it count once, for anyone.", icon: "M8 8h8v8H8zM4 12h4M16 12h4M12 4v4M12 16v4" },
  { t: "Verification", u: "The signature and the rules are checked on-chain.", tech: "ReceiptCommitmentRegistry calls the ECDSA attestation verifier, then EligibilityPolicy (brand, INR, amount, date) and RewardPolicy (rate, per-claim and daily caps, sponsor budget).", icon: "M5 12l4 4 10-10" },
  { t: "Conditional claim", u: "Your reward is locked in a claim, not paid out yet.", tech: "RewardPool escrows the reward in mock tokenized equity and ConditionalClaim mints an ERC-721 with unlockAt = purchase time + the category's return window (5–10 min demo windows on testnet; 14–30 days in production). Stages 3 to 6 are one transaction.", icon: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" },
  { t: "Instant exit", u: "Don't want to wait? Sell the locked claim now.", tech: "InstantExitPool.quote prices it: amount × (1 − refund probability × wallet risk) × (1 − time value to unlock) × (1 − LP fee). sellClaim pays you in the equity token and the pool becomes the holder.", icon: "M5 12h14M13 6l6 6-6 6" },
  { t: "Void", u: "If the purchase is refunded before unlock, the claim dies.", tech: "A refund attester signs an EIP-712 RefundAttestation(claimId, refundRef, deadline); VoidOracle checks it, burns refundRef so one refund can't void two claims, and the escrow returns to the sponsor. If a pool holds the claim, that is the LP's loss.", icon: "M6 6l12 12M18 6L6 18" },
  { t: "Settle", u: "After the window closes, the equity is released.", tech: "Anyone can call settle(id) once unlockAt has passed. The escrowed equity goes to whoever holds the claim: you, or the pool that bought it, which books the gain.", icon: "M5 12l4 4 10-10M4 20h16" },
  { t: "The market", u: "LPs earn by pricing refund risk well.", tech: "LPs deposit equity into a brand's pool and earn the discount on claims that settle, minus losses on claims voided by refunds. Every quote, sale, void and settlement is on Monad.", icon: "M4 19l5-6 4 3 7-9M4 5v14h16" },
];

export default function HowItWorksPage() {
  return (
    <div>
      <header className="relative isolate overflow-hidden">
        <Image src="/art/panel.webp" alt="" width={160} height={365} className="float absolute right-[8%] top-16 -z-10 hidden h-auto w-28 lg:block" />
        <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-24 sm:px-8">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-6 font-display text-[clamp(2.8rem,7vw,6rem)] font-extrabold leading-[0.96]">
            <RevealLines lines={["From receipt", "to tradeable claim,", "in ten stages."]} />
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
          <p className="max-w-xl font-display text-3xl font-bold leading-tight">Try it with a demo receipt. It takes under a minute, on Monad testnet.</p>
          <ButtonLink href="/app/scan">
            Scan a receipt <Arrow />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
