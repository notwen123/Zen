"use client";

import { Seal } from "@/components/art/Art";
import type { ClaimState } from "@/components/claims/LockedEquity";

/**
 * The return window as an ink stroke: it fills from purchase to unlock, and the vermilion seal is stamped
 * when the equity is free to settle. A refunded claim ends in a struck-through seal; a cashed-out claim
 * shows the stroke handed to the pool.
 */
export function SealProgress({ start, end, now, state }: { start: number; end: number; now: number; state: ClaimState }) {
  const total = Math.max(1, end - start);
  const done = state === "settled" || state === "voided" || now >= end;
  const p = done ? 1 : Math.min(1, Math.max(0, (now - start) / total));
  const label =
    state === "voided"
      ? "Refunded before unlock"
      : state === "settled"
        ? "Settled"
        : state === "cashed"
          ? now >= end
            ? "Pool's claim has unlocked"
            : "Held by the pool until unlock"
          : now >= end
            ? "Unlocked: ready to settle"
            : `${Math.round(p * 100)}% through the return window`;

  return (
    <div className="mt-5" role="img" aria-label={label}>
      <div className="flex items-center gap-3">
        <div className="relative h-[6px] flex-1 overflow-hidden rounded-full bg-ink/10">
          <span
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out ${state === "voided" ? "bg-stone" : "bg-ink"}`}
            style={{ width: `${p * 100}%` }}
          />
        </div>
        <span className={`relative grid h-8 w-8 shrink-0 place-items-center transition-all duration-500 ${done && state !== "voided" ? "scale-100 opacity-100" : "scale-90 opacity-30 grayscale"}`}>
          <Seal size={30} />
          {state === "voided" && <span className="absolute h-[2px] w-9 -rotate-45 bg-ink" aria-hidden="true" />}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
    </div>
  );
}
