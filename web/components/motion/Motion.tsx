"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Blur-to-sharp masked reveal when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      {children}
    </M>
  );
}

/** Headline lines rising from behind a mask, one after another. The un-transformed wrapper is what
 *  gets observed: a line translated below its overflow mask is clipped and would never "enter view". */
export function RevealLines({ lines, className, delay = 0, lineClassName }: { lines: ReactNode[]; className?: string; delay?: number; lineClassName?: string }) {
  return (
    <motion.span
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-5% 0px" }}
      transition={{ staggerChildren: 0.14, delayChildren: delay }}
    >
      {lines.map((l, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className={`block ${lineClassName ?? ""}`}
            variants={{ hidden: { y: "105%" }, show: { y: "0%", transition: { duration: 1, ease: EASE } } }}
          >
            {l}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/** Scroll-linked vertical drift. speed < 0 moves up slower than scroll (background), > 0 faster. */
export function Parallax({ children, speed = -0.15, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-speed * 100}px`, `${speed * 100}px`]);
  return (
    <motion.div ref={ref} style={reduce ? undefined : { y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Number count-up once in view. */
export function CountUp({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [text, setText] = useState(format(0));
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(mv, value, { duration: 1.4, ease: EASE, onUpdate: (v) => setText(format(v)) });
    return () => c.stop();
  }, [inView, value, reduce, format, mv]);
  // Screen readers always get the real value; the animated digits are decorative.
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{reduce ? format(value) : text}</span>
    </span>
  );
}
