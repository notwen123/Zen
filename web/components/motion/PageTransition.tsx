"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/** Page enters under a thin red ink stroke that sweeps across (~450ms). */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2px] origin-left bg-vermilion"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ scaleX: { duration: 0.45, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2, delay: 0.4 } }}
      />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </motion.div>
    </>
  );
}
