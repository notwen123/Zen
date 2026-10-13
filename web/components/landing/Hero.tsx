"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BrushStroke, Petals, TestnetSeal } from "@/components/art/Art";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";

const EASE = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Scan", "Prove", "Own"];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const land = useTransform(scrollYProgress, [0, 1], ["0px", "90px"]); // slowest layer
  const phone = useTransform(scrollYProgress, [0, 1], ["0px", "-80px"]); // medium
  const type = useTransform(scrollYProgress, [0, 1], ["0px", "-30px"]); // slight

  return (
    <section ref={ref} className="relative isolate overflow-hidden" aria-labelledby="hero-title">
      {/* Sumi-e landscape: paper, vermilion sun, Fuji, torii, blossoms */}
      <motion.div style={reduce ? undefined : { y: land }} className="absolute inset-0 -z-10">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          <Image
            src="/art/hero-landscape.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[88%_55%] md:object-[62%_60%]"
          />
        </motion.div>
        {/* soften behind the headline, and fade into the page below */}
        <div className="absolute inset-0 bg-gradient-to-r from-paper/85 via-paper/35 to-transparent md:via-paper/10" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-paper" />
      </motion.div>
      <Petals />

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-[1320px] items-center gap-6 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-16">
        <motion.div style={reduce ? undefined : { y: type }} className="relative z-10">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }}>
            <Eyebrow className="text-charcoal">Proof of purchase → Proof of ownership</Eyebrow>
          </motion.div>
          <h1 id="hero-title" className="mt-5 font-display text-[clamp(3.8rem,11.5vw,8.6rem)] font-extrabold leading-[0.9] tracking-[-0.02em]">
            {["Scan.", "Prove.", "Own."].map((w, i) => (
              <span key={w} className={`block overflow-hidden ${w === "Own." ? "pb-[0.18em]" : "pb-[0.06em]"}`}>
                <motion.span
                  className="block"
                  initial={{ y: "105%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 1.1, delay: 0.45 + i * 0.16, ease: EASE }}
                >
                  {w === "Own." ? (
                    <span className="relative inline-block isolate">
                      Own<span className="text-vermilion">.</span>
                      <BrushStroke className="absolute -bottom-[0.13em] -left-[0.04em] -z-10 h-[0.22em] w-[108%]" delay={1500} />
                    </span>
                  ) : (
                    w
                  )}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.2, ease: EASE }}>
            <p className="mt-7 max-w-md text-lg leading-relaxed text-ink sm:text-xl">Turn everyday purchases into programmable ownership.</p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-charcoal">
              STOCKBACK connects attested purchase receipts with on-chain ownership rewards, held in brand vaults you control.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <ButtonLink href="/app/scan">
                Scan a receipt <Arrow />
              </ButtonLink>
              <ButtonLink href="/how-it-works" variant="ghost" className="bg-paper/60 backdrop-blur-sm">
                Explore how it works
              </ButtonLink>
            </div>
            <TestnetSeal className="mt-7 bg-paper/70" />
          </motion.div>
        </motion.div>

        <motion.div style={reduce ? undefined : { y: phone }} className="relative mx-auto w-full max-w-[420px] lg:max-w-[460px]">
          <PhoneComposition />
        </motion.div>
      </div>
    </section>
  );
}

function PhoneComposition() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 1900);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 60, rotate: 6 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 1.4, delay: 0.6, ease: EASE }}
      >
        {/* Shadow lives on the wrapper so it follows the masked phone shape instead of being clipped into a box. */}
        <div className="float drop-shadow-[0_40px_45px_rgba(23,23,23,.28)]" style={{ ["--float-dur" as string]: "9s", ["--r" as string]: "-1deg" }}>
          <Image
            src="/art/hero-phone-bw.webp"
            alt="A hand holding a phone that is scanning a Nike receipt for ₹2,000 dated 28 Sep 2026"
            width={900}
            height={1147}
            priority
            sizes="(min-width: 1024px) 460px, 80vw"
            className="h-auto w-full [mask-image:linear-gradient(to_bottom,black_78%,transparent)]"
          />
        </div>
      </motion.div>

      {/* SCAN -> PROVE -> OWN rail */}
      <motion.ol
        aria-label="Scan, prove, own"
        className="absolute -left-2 top-[18%] hidden flex-col gap-2 sm:flex"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1.6, ease: EASE }}
      >
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={`border px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.22em] backdrop-blur-sm transition-colors duration-500 ${
              i === step ? "border-ink bg-ink text-paper" : "border-ink/25 bg-paper/75 text-charcoal"
            }`}
          >
            0{i + 1} {s}
          </li>
        ))}
      </motion.ol>

      {/* ownership seal */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-[16%] -left-3 grid h-28 w-28 place-items-center rounded-full border-[3px] border-vermilion bg-paper/85 text-center font-display text-[0.7rem] font-bold uppercase leading-tight tracking-[0.2em] text-vermilion backdrop-blur-sm sm:-left-10"
        initial={{ opacity: 0, scale: 1.8, rotate: -30 }}
        animate={{ opacity: 1, scale: 1, rotate: -12 }}
        transition={{ duration: 0.45, delay: 2.2, ease: [0.3, 1.4, 0.5, 1] }}
      >
        Nike vault
        <br />
        +15.00
      </motion.div>
    </div>
  );
}
