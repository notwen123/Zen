"use client";

import { motion } from "motion/react";
import type { VerifierKind } from "@/lib/zen";

export type PipelinePhase = "waiting" | "running" | "done" | "failed";

/** The six gates of submitClaim. They all run inside ONE transaction, so while it is pending the
 *  steps only "breathe"; checkmarks appear after the receipt confirms success. */
export function VerificationPipeline({ phase, verifier }: { phase: PipelinePhase; verifier: VerifierKind }) {
  const steps = [
    ["Commit", "Claim commitment recorded"],
    ["Nullifier", "Receipt marked as used"],
    ["Signature", verifier === "ecdsa" ? "ECDSA attestation verified" : "Attestation verified"],
    ["Eligibility", "Brand, amount and date rules"],
    ["Reward", "Rate and caps applied"],
    ["Claim", "Equity escrowed, locked for the return window"],
  ];
  return (
    <ol className="grid grid-cols-2 gap-px bg-ink/10 sm:grid-cols-3" aria-live="polite">
      {steps.map(([t, d], i) => (
        <li key={t} className="bg-paper p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.68rem] uppercase tracking-[0.2em]">{t}</span>
            {phase === "done" ? (
              <motion.span
                initial={{ scale: 0, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: i * 0.12, type: "spring", stiffness: 380, damping: 18 }}
                className="grid h-5 w-5 place-items-center rounded-full bg-vermilion text-[0.6rem] text-paper"
                aria-label="done"
              >
                ✓
              </motion.span>
            ) : phase === "running" ? (
              <span className="breathe h-2 w-2 rounded-full bg-ink" style={{ animationDelay: `${i * 0.22}s` }} aria-label="verifying" />
            ) : phase === "failed" ? (
              <span className="h-2 w-2 rounded-full bg-stone" aria-label="not completed" />
            ) : (
              <span className="h-2 w-2 rounded-full border border-ink/30" aria-label="waiting" />
            )}
          </div>
          <p className="mt-2 text-xs text-muted">{d}</p>
        </li>
      ))}
    </ol>
  );
}
