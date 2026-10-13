"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

const WORDS = ["Scan", "Prove", "Own"];

function Line({ dir }: { dir: 1 | -1 }) {
  return (
    <span className="flex shrink-0 items-center gap-10 pr-10">
      {Array.from({ length: 4 }).flatMap((_, r) =>
        WORDS.map((w) => (
          <span key={`${r}-${w}`} className="flex items-center gap-10">
            <span
              className={`font-display text-[clamp(4rem,11vw,10rem)] font-extrabold uppercase leading-none tracking-[-0.01em] ${
                w === "Own" ? "text-ink" : "text-transparent [-webkit-text-stroke:1.5px_var(--stockback-ink)]"
              }`}
            >
              {w}
            </span>
            <span className={`h-4 w-4 rounded-full ${dir === 1 ? "bg-vermilion" : "bg-ink"}`} aria-hidden="true" />
          </span>
        )),
      )}
    </span>
  );
}

/** Two rows of oversized type that slide in opposite directions with scroll. */
export function KineticType() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const a = useTransform(scrollYProgress, [0, 1], ["0%", "-35%"]);
  const b = useTransform(scrollYProgress, [0, 1], ["-35%", "0%"]);
  return (
    <div ref={ref} aria-hidden="true" className="overflow-hidden py-10 sm:py-14">
      <motion.div style={reduce ? undefined : { x: a }} className="flex w-max">
        <Line dir={1} />
      </motion.div>
      <motion.div style={reduce ? undefined : { x: b }} className="mt-2 flex w-max">
        <Line dir={-1} />
      </motion.div>
    </div>
  );
}
