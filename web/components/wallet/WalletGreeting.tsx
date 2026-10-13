"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAccountEffect } from "wagmi";
import { Seal } from "@/components/art/Art";

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Good evening." : h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
};

/** After a fresh wallet connection on a public page: a short ink greeting, then the dashboard. */
export function WalletGreeting() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useAccountEffect({
    onConnect({ isReconnected }) {
      if (isReconnected || pathname.startsWith("/app")) return;
      setShow(true);
      router.prefetch("/app/dashboard");
      setTimeout(() => router.push("/app/dashboard"), 2600);
      setTimeout(() => setShow(false), 3200);
    },
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] grid place-items-center bg-paper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="px-6 text-center">
            <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
              <Seal size={56} className="mx-auto" />
            </motion.div>
            <motion.p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              {greeting()}
            </motion.p>
            <motion.h2 className="mt-4 font-display text-4xl font-bold sm:text-6xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}>
              Welcome to Stockback.
            </motion.h2>
            <motion.p className="mt-5 text-lg text-charcoal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 0.8 }}>
              Your purchases can now become ownership.
            </motion.p>
            <motion.div className="mx-auto mt-10 h-px w-40 origin-left bg-vermilion" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.5, duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
