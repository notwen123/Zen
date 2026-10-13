"use client";

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { InkSun, Petals } from "@/components/art/Art";
import { BrandMark } from "@/components/brand/BrandMark";
import { brandById } from "@/lib/brands";
import { txUrl } from "@/lib/chain";

const EASE = [0.22, 1, 0.36, 1] as const;
const NIKE = brandById("NIKE")!;

// Fingerprints of the receipt shown (Nike Store, Bengaluru · UPI ••••7421), derived with the
// same attester code the app uses. `tx` is a real ₹2,000 Nike claim settled on Robinhood testnet.
const REAL = {
  merchantId: "0x4acead6498578e2af4575124bcfe7934866ffd6c43923cc17fc7675ebb645121",
  receiptHash: "0xde3c4463b1c9e7b0f7b2d4c5a62f669663035c501197f7a64e82e56a9bda07a1",
  tx: "0x4e2c8097030ef2b0842b0e6dbb79675437637dea04dfb7531d0938a13ff9c604",
};
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

const CHAPTERS = [
  { key: "Scan", title: "A purchase, captured.", body: "Scan any receipt. It never leaves your hands." },
  { key: "Prove", title: "Hashed, not exposed.", body: "Merchant and receipt become fingerprints. No personal data goes on-chain." },
  { key: "Verify", title: "Checked by Stylus.", body: "An Ed25519 signature, verified in Rust on Arbitrum. Each receipt counts once." },
  { key: "Own", title: "Owned, not pointed.", body: "The reward lands as shares of the brand's vault, in your wallet." },
];

/** Pinned scroll story: one receipt, transformed step by step as you scroll. */
export function Journey() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(3, Math.max(0, Math.floor(v * 4.4)))));
  const c = CHAPTERS[step];

  return (
    <section ref={ref} aria-label="From receipt to ownership" className="relative h-[360vh]">
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] items-center overflow-hidden">
        {/* atmosphere: a faint vermilion sun that warms as the story progresses, and drifting petals */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute right-[-8%] top-1/2 -z-10 w-[min(70vw,760px)] -translate-y-1/2"
          animate={{ opacity: 0.025 + step * 0.012, scale: 0.92 + step * 0.03 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <InkSun className="h-auto w-full" />
        </motion.div>
        <Petals />
        <div className="mx-auto grid w-full max-w-[1320px] items-center gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
          {/* chapter text */}
          <div className="order-2 lg:order-1">
            <ol className="flex gap-2" aria-label="Steps">
              {CHAPTERS.map((ch, i) => (
                <li key={ch.key} className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[0.68rem] uppercase tracking-[0.22em] transition-colors duration-500 ${i === step ? "text-ink" : "text-stone"}`}
                    aria-current={i === step ? "step" : undefined}
                  >
                    {ch.key}
                  </span>
                  {i < 3 && <span className={`h-px w-6 transition-colors duration-500 sm:w-10 ${i < step ? "bg-vermilion" : "bg-ink/20"}`} />}
                </li>
              ))}
            </ol>
            <AnimatePresence mode="wait">
              <motion.div
                key={c.key}
                initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? undefined : { opacity: 0, y: -16, filter: "blur(4px)" }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <h2 className="mt-8 font-display text-[clamp(2.6rem,6vw,5.4rem)] font-extrabold leading-[0.98]">{c.title}</h2>
                <p className="mt-6 max-w-md text-lg text-charcoal">{c.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* stage */}
          <div className="relative order-1 mx-auto flex h-[46vh] w-full max-w-[420px] items-center justify-center lg:order-2 lg:h-[64vh]">
            <AnimatePresence mode="wait">
              {step < 3 ? (
                <motion.div
                  key="receipt"
                  initial={{ opacity: 0, y: 40, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, rotate: step === 0 ? -2 : 0 }}
                  exit={{ opacity: 0, scale: 0.4, rotate: 10, filter: "blur(6px)" }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="relative w-full max-w-[360px] bg-[#FBF8F1] px-7 pb-9 pt-7 font-mono text-[0.75rem] shadow-[0_50px_70px_-40px_rgba(23,23,23,.55)]"
                >
                  <div className="flex justify-center">
                    <BrandMark brand={NIKE} className="h-9 w-14" />
                  </div>
                  <p className="mt-2 text-center font-display text-3xl font-extrabold tracking-[0.25em]">NIKE</p>
                  <div className="my-4 border-t border-dashed border-ink/30" />
                  <Row k="Merchant" plain="Nike Store, Bengaluru" hash={short(REAL.merchantId)} hashed={step >= 1} />
                  <Row k="Receipt" plain="UPI ••••7421" hash={short(REAL.receiptHash)} hashed={step >= 1} />
                  <Row k="Date" plain="12 JAN 2026" hash="12 JAN 2026" hashed={false} />
                  <div className="my-4 border-t border-dashed border-ink/30" />
                  <div className="flex justify-between text-base font-medium">
                    <span>TOTAL</span>
                    <span className="tabular">₹2,000.00</span>
                  </div>
                  {step === 0 && !reduce && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="scan-line absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-transparent via-vermilion/15 to-transparent" style={{ ["--scan-h" as string]: "260px" }} />
                      <div className="scan-line absolute inset-x-0 top-6 h-px bg-vermilion" style={{ ["--scan-h" as string]: "260px" }} />
                    </div>
                  )}
                  <AnimatePresence>
                    {step >= 1 && (
                      <motion.p
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-5 text-center text-[0.62rem] uppercase tracking-[0.2em] text-muted"
                      >
                        salted keccak256 · no personal data
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {step === 2 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 2.2, rotate: -30 }}
                        animate={{ opacity: 1, scale: 1, rotate: -12 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.3, 1.4, 0.5, 1] }}
                        className="absolute -right-6 -top-6 grid h-32 w-32 place-items-center rounded-full border-[3px] border-vermilion bg-paper/85 text-center font-display text-[0.7rem] font-bold uppercase leading-tight tracking-[0.18em] text-vermilion backdrop-blur-sm"
                      >
                        Verified
                        <br />
                        Stylus
                        <br />
                        Ed25519
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="share"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="float grid h-44 w-44 place-items-center rounded-full bg-ink text-paper shadow-[0_40px_60px_-30px_rgba(23,23,23,.6)]">
                    <BrandMark brand={NIKE} className="h-12 w-20 text-paper" />
                  </div>
                  <p className="mt-8 font-display text-5xl font-extrabold tabular">
                    +15.00 <span className="text-2xl">sbNKE</span>
                  </p>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-muted">Nike vault · ERC-4626 · demo asset</p>
                  <a className="ink-link mt-5 font-mono text-xs" href={txUrl(REAL.tx)} target="_blank" rel="noreferrer">
                    a real ₹2,000 Nike claim · {short(REAL.tx)} ↗
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({ k, plain, hash, hashed }: { k: string; plain: string; hash: string; hashed: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="uppercase text-muted">{k}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={hashed ? "h" : "p"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className={`truncate ${hashed ? "text-vermilion-deep" : ""}`}
        >
          {hashed ? hash : plain}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
