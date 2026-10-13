import Image from "next/image";
import Link from "next/link";
import { Petals } from "@/components/art/Art";
import { BrandMark } from "@/components/brand/BrandMark";
import { Reveal, RevealLines } from "@/components/motion/Motion";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";
import { BRANDS } from "@/lib/brands";
import { GITHUB_URL } from "@/lib/chain";
import { EVIDENCE } from "@/lib/evidence";
import { LivePortfolioPreview } from "./LivePortfolioPreview";

function SectionHead({ eyebrow, title, className }: { eyebrow: string; title: React.ReactNode[]; className?: string }) {
  return (
    <div className={className}>
      <Reveal>
        <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />
          {eyebrow}
        </p>
      </Reveal>
      <h2 className="mt-6 font-display text-[clamp(2.3rem,5.4vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.01em]">
        <RevealLines lines={title} />
      </h2>
    </div>
  );
}

const Wrap = ({ children, className, id, label }: { children: React.ReactNode; className?: string; id?: string; label: string }) => (
  <section id={id} aria-label={label} className={`relative mx-auto max-w-[1320px] px-5 sm:px-8 ${className ?? ""}`}>
    {children}
  </section>
);

const RIDGE_BACK = "M0 140V96l120-34 110 22 140-58 120 46 110-28 150-40 130 52 120-24 140 38 110-30 160 26 110-12v92z";
const RIDGE_FRONT = "M0 140v-30l160-36 120 28 150-44 130 40 140-26 120 18 150-50 140 46 120-20 150 30 140-14v58z";

const OUTCOMES = [
  { k: "Sell", t: "Instant exit", b: "Sell the locked claim to the brand's LP pool at a discount, today. The pool now carries the refund risk." },
  { k: "Void", t: "Refund proven", b: "A refund proven before unlock voids the claim. The escrow returns to the sponsor; the holder gets nothing." },
  { k: "Settle", t: "Window closes", b: "After unlock, anyone can settle. The escrowed equity goes to whoever holds the claim." },
];

const WHY_MONAD = [
  ["Sub-second finality", "An instant exit is actually instant: once your wallet signs, the sale is final in about a second."],
  ["Cheap per-claim settlement", "Every claim is minted, sold, voided or settled on its own. No batching, no waiting for a cheaper hour."],
  ["Plain EVM", "Solidity contracts, EIP-712 attestations, ECDSA signatures. Nothing exotic to audit."],
];

/** The product on one ink panel: the claim lifecycle and why it settles on Monad. */
export function LifecycleSection() {
  return (
    <div className="relative text-paper">
      {/* the ink section rises out of a mountain ridge instead of a hard slide edge */}
      <svg aria-hidden="true" viewBox="0 0 1440 140" preserveAspectRatio="none" className="block h-24 w-full sm:h-32">
        <path d={RIDGE_BACK} fill="var(--zen-ink)" opacity=".25" />
        <path d={RIDGE_FRONT} fill="var(--zen-ink)" />
      </svg>
      <div className="bg-ink">
        <Wrap label="Claim lifecycle and why Monad" className="py-16 sm:py-20">
          <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <Reveal>
                <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-stone">
                  <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />
                  Why Monad
                </p>
              </Reveal>
              <h2 className="mt-6 font-display text-[clamp(2.3rem,4.6vw,4rem)] font-bold leading-[1.02]">
                <RevealLines lines={["Refund risk,", "priced and settled."]} />
              </h2>
              <Reveal delay={0.15}>
                <p className="mt-8 max-w-md text-paper/75">
                  A stock-back reward can&apos;t be yours until the return window closes. Zen turns that wait into a market: the claim trades while it is locked, and the
                  price of an early exit is the price of refund risk.
                </p>
              </Reveal>
              <ul className="mt-10 space-y-6">
                {WHY_MONAD.map(([t, b], i) => (
                  <Reveal as="li" key={t} delay={0.2 + i * 0.08} className="border-l-2 border-vermilion pl-4">
                    <p className="font-display text-lg font-bold">{t}</p>
                    <p className="mt-1 text-sm text-paper/70">{b}</p>
                  </Reveal>
                ))}
              </ul>
            </div>

            <Reveal delay={0.15}>
              <ol aria-label="Claim lifecycle" className="space-y-px">
                <Step n="01" t="Verified purchase" b="A merchant-signed receipt (or an attested entry) is checked once and hashed. No personal data goes on-chain." />
                <Step
                  n="02"
                  t="Conditional claim"
                  b="Mock tokenized equity is escrowed in an ERC-721 claim, locked for the return window: 5–10 minute demo windows on testnet, 14–30 days in production."
                />
                <li className="grid gap-px pt-px sm:grid-cols-3">
                  {OUTCOMES.map((o) => (
                    <div key={o.k} className="bg-paper/[0.06] p-5">
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-vermilion">{o.k}</p>
                      <p className="mt-3 font-display text-lg font-bold">{o.t}</p>
                      <p className="mt-2 text-sm leading-relaxed text-paper/70">{o.b}</p>
                    </div>
                  ))}
                </li>
              </ol>
              <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-stone">Mock equity · simulated merchant · Monad testnet</p>
            </Reveal>
          </div>
        </Wrap>
      </div>
      <svg aria-hidden="true" viewBox="0 0 1440 140" preserveAspectRatio="none" className="block h-24 w-full -scale-y-100 sm:h-32">
        <path d={RIDGE_BACK} fill="var(--zen-ink)" opacity=".25" />
        <path d={RIDGE_FRONT} fill="var(--zen-ink)" />
      </svg>
    </div>
  );
}

function Step({ n, t, b }: { n: string; t: string; b: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-5 bg-paper/[0.06] p-5">
      <span className="font-display text-3xl font-extrabold text-vermilion">{n}</span>
      <div>
        <p className="font-display text-lg font-bold">{t}</p>
        <p className="mt-1 text-sm leading-relaxed text-paper/70">{b}</p>
      </div>
    </li>
  );
}

export function Ownership() {
  return (
    <Wrap id="ownership" label="Ownership" className="py-24 sm:py-32">
      <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <SectionHead eyebrow="Not points" title={["A claim on the brands", "you buy."]} />
          <ul className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
            {BRANDS.map((b, i) => (
              <Reveal as="li" key={b.id} delay={i * 0.1}>
                <div className="group flex items-center gap-6 py-5">
                  <BrandMark brand={b} className="h-9 w-14 transition-transform duration-500 group-hover:-translate-y-0.5" />
                  <span className="font-display text-3xl font-extrabold tracking-[0.04em]">{b.name}</span>
                  <span className="ml-auto text-right font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
                    {b.asset}
                    <span className="block text-vermilion-deep">mock equity</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
          <p className="mt-6 max-w-md text-xs leading-relaxed text-muted">
            One mock tokenized-equity token per brand, escrowed claim by claim. Testnet tokens are fictional, not securities, and not affiliated with these brands.
          </p>
        </div>
        <Reveal delay={0.15}>
          <LivePortfolioPreview />
        </Reveal>
      </div>
    </Wrap>
  );
}

/** What each kind of proof actually establishes. Kept honest on purpose. */
export function Evidence() {
  return (
    <Wrap label="Evidence" className="py-16 sm:py-24">
      <SectionHead eyebrow="Evidence" title={["Not every proof", "proves the same thing."]} />
      <ol className="mt-12 grid gap-px bg-ink/10 md:grid-cols-3">
        {Object.values(EVIDENCE).map((e, i) => (
          <Reveal as="li" key={e.label} delay={i * 0.08} className={`bg-paper p-7 ${e.status === "Roadmap" ? "text-muted" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-5xl font-extrabold text-vermilion/90">{e.tier}</span>
              <span className={`border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${e.status === "Roadmap" ? "border-dashed border-ink/30" : "border-ink/40 text-ink"}`}>{e.status}</span>
            </div>
            <p className="mt-6 font-display text-xl font-bold text-ink">{e.label}</p>
            <p className="mt-2 text-sm leading-relaxed">{e.body}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal>
        <Link className="ink-link mt-8 inline-block font-mono text-xs uppercase tracking-[0.18em]" href="/merchant">
          Try the simulated merchant POS →
        </Link>
      </Reveal>
    </Wrap>
  );
}

export function Security() {
  const items = ["One claim per receipt", "Capped rewards", "On-chain eligibility", "Merchant signatures checked", "One refund voids one claim", "Testnet only"];
  return (
    <Wrap label="Security" className="py-16 sm:py-20">
      <div className="flex flex-col gap-8 border-y border-ink/15 py-10 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-xs font-display text-2xl font-bold leading-tight">Evidence, verification and ownership, kept apart.</p>
        <ul className="flex flex-wrap gap-x-8 gap-y-4">
          {items.map((t, i) => (
            <Reveal as="li" key={t} delay={i * 0.06} className="flex items-center gap-2.5 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-vermilion text-[0.7rem] text-vermilion" aria-hidden="true">✓</span>
              {t}
            </Reveal>
          ))}
        </ul>
        <a className="ink-link shrink-0 font-mono text-xs uppercase tracking-[0.18em]" href={`${GITHUB_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
          Security model ↗
        </a>
      </div>
    </Wrap>
  );
}

export function FinalCta() {
  return (
    <section aria-label="Get started" className="relative isolate overflow-hidden">
      {/* light ink landscape: blossoms frame the left, mountains the right, the statement sits in the open sky */}
      <Image
        src="/art/cta-sky.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 object-cover object-center opacity-90 [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,.25)_12%,black_32%,black_68%,rgba(0,0,0,.25)_88%,transparent_100%)]"
      />
      <Petals count={18} />
      <div className="mx-auto flex min-h-[640px] max-w-[860px] flex-col items-center justify-center px-5 py-28 text-center sm:px-8 lg:min-h-[720px]">
        <h2 className="font-display text-[clamp(2.4rem,5vw,4.4rem)] font-extrabold leading-[1]">
          <RevealLines lines={["Your next receipt", "is a claim you", <span key="own">can trade<span className="text-vermilion">.</span></span>]} />
        </h2>
        <Reveal delay={0.3} className="mt-10 flex flex-wrap justify-center gap-4">
          <ButtonLink href="/app/dashboard">
            Start Zen <Arrow />
          </ButtonLink>
          <ButtonLink href="/about" variant="ghost" className="bg-paper/70 backdrop-blur-sm">
            Read the protocol
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

export { Eyebrow };
