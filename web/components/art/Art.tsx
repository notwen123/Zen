// Hand-drawn SVG art for STOCKBACK. Server-safe, no JS; motion comes from CSS classes in globals.css.
import type { CSSProperties } from "react";

type P = { className?: string; style?: CSSProperties };

/** Circular red seal - the STOCKBACK mark. */
export function Seal({ className, style, size = 32 }: P & { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path
        d="M32 3.5c15.9 0 28.6 12.6 28.4 28.6-.2 15.7-12.8 28.3-28.6 28.4C16.1 60.6 3.4 47.9 3.5 32 3.6 16.2 16.2 3.4 32 3.5z"
        fill="var(--stockback-red)"
      />
      <path
        d="M42 21.5c-2.6-2.4-6-3.6-9.6-3.6-5.6 0-9.4 2.9-9.4 7.1 0 9.2 19.3 5.5 19.3 14.6 0 4.5-4.2 7.6-10.1 7.6-4 0-7.8-1.4-10.6-4.1"
        fill="none"
        stroke="var(--stockback-paper)"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: P) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Seal size={26} />
      <span className="font-display text-[1.05rem] font-bold tracking-[0.22em]">STOCKBACK</span>
    </span>
  );
}

/** Large vermilion sun with a slightly uneven, hand-inked edge. */
export function InkSun({ className, style }: P) {
  return (
    <svg viewBox="0 0 400 400" className={className} style={style} aria-hidden="true">
      <defs>
        <radialGradient id="sun-g" cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="#D2483C" />
          <stop offset=".7" stopColor="#C83A2F" />
          <stop offset="1" stopColor="#A92E25" />
        </radialGradient>
      </defs>
      <path
        d="M200 18c101 1 183 82 182 183-2 100-83 181-183 181C99 381 17 300 18 199 19 99 100 17 200 18z"
        fill="url(#sun-g)"
      />
      <path d="M58 150c40-6 82-4 120 2M232 262c42 2 78-2 108-10" stroke="#F4EFE3" strokeOpacity=".12" strokeWidth="3" fill="none" />
    </svg>
  );
}

/** Three ink-wash ridges. */
export function Mountains({ className, style }: P) {
  return (
    <svg viewBox="0 0 1440 360" preserveAspectRatio="none" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4EFE3" stopOpacity="0" />
          <stop offset="1" stopColor="#F4EFE3" stopOpacity=".95" />
        </linearGradient>
      </defs>
      <path
        d="M0 210 140 150 230 176 360 96 470 158 560 128 690 40 800 124 930 104 1040 160 1170 88 1290 150 1440 118V360H0z"
        fill="#B8B0A2"
        opacity=".35"
      />
      <path
        d="M0 262 120 214 250 240 380 170 520 236 640 200 760 150 900 222 1010 196 1150 250 1290 196 1440 232V360H0z"
        fill="#343230"
        opacity=".22"
      />
      <path d="M0 300 160 268 330 292 470 250 640 296 820 264 990 300 1160 272 1320 298 1440 284V360H0z" fill="#171717" opacity=".16" />
      <rect width="1440" height="360" fill="url(#mist)" />
    </svg>
  );
}

/** Cherry blossom branch in line art with a few filled blossoms. */
export function Blossom({ className, style }: P) {
  const flower = (x: number, y: number, s = 1, filled = false) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((r) => (
        <ellipse
          key={r}
          cx="0"
          cy="-9"
          rx="5.2"
          ry="8.5"
          transform={`rotate(${r})`}
          fill={filled ? "#E7B8B0" : "none"}
          stroke="#8F211D"
          strokeOpacity=".55"
          strokeWidth="1"
        />
      ))}
      <circle r="2.2" fill="#C83A2F" />
    </g>
  );
  return (
    <svg viewBox="0 0 420 260" className={className} style={style} aria-hidden="true" fill="none">
      <path
        d="M420 18C352 30 300 58 250 96c-44 34-78 52-126 62M300 58c-8 30-6 58 8 86M250 96c26 4 50 16 66 36M180 128c-4 26 2 50 18 70"
        stroke="#171717"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M124 158c-30 6-58 22-80 44" stroke="#171717" strokeWidth="1.4" strokeLinecap="round" />
      {flower(300, 60, 1.1, true)}
      {flower(316, 132, 0.9)}
      {flower(250, 98, 1, true)}
      {flower(198, 196, 0.85)}
      {flower(126, 158, 0.95, true)}
      {flower(48, 200, 0.7)}
      {flower(358, 34, 0.75)}
    </svg>
  );
}

/** A single brush stroke that draws itself (used under "OWN."). */
export function BrushStroke({ className, style, delay = 900 }: P & { delay?: number }) {
  return (
    <svg viewBox="0 0 520 60" className={className} style={style} aria-hidden="true" fill="none">
      <path
        className="draw"
        style={{ ["--len" as string]: 560, ["--delay" as string]: `${delay}ms`, ["--dur" as string]: "1100ms" }}
        d="M6 38c60-14 150-22 250-20 90 2 170 8 258-4"
        stroke="var(--stockback-red)"
        strokeWidth="11"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Deterministic pseudo-random (same on server and client, so no hydration mismatch).
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Drifting blossom petals: each one falls while swaying (hidden under reduced motion). */
export function Petals({ className, count = 5 }: P & { count?: number }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const s = 0.6 + rnd(i, 1) * 0.9;
        return (
          <span
            key={i}
            className="petal absolute top-0"
            style={{
              left: `${(i / count) * 100 + rnd(i, 2) * (100 / count)}%`,
              ["--delay" as string]: `${-rnd(i, 3) * 18}s`,
              ["--fall" as string]: `${13 + rnd(i, 4) * 10}s`,
              ["--drift" as string]: `${-60 - rnd(i, 5) * 160}px`,
            }}
          >
            <svg
              viewBox="0 0 12 16"
              width={12 * s}
              height={16 * s}
              className="petal-sway block"
              style={{ ["--sway-dur" as string]: `${2.6 + rnd(i, 6) * 2.2}s`, opacity: 0.55 + rnd(i, 7) * 0.4 }}
            >
              <path d="M6 0C10 3 12 8 6 16 0 8 2 3 6 0z" fill={rnd(i, 8) > 0.35 ? "#E58A80" : "#C83A2F"} />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

/** Small red seal badge: ROBINHOOD TESTNET · DEMO ASSETS. */
export function TestnetSeal({ className, compact = false }: P & { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 border border-vermilion/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-vermilion-deep ${className ?? ""}`}
      title="Robinhood Chain testnet. All brand assets are simulated demo tokens, not securities."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />
      {compact ? "Testnet · Demo" : "Robinhood Testnet · Demo Assets"}
    </span>
  );
}

/** Stamp that presses in (used for verified / ownership created). */
export function Stamp({ label, className }: P & { label: string }) {
  return (
    <span
      className={`inline-grid place-items-center rounded-full border-[3px] border-vermilion px-5 py-5 font-display text-sm font-bold uppercase leading-none tracking-[0.2em] text-vermilion ${className ?? ""}`}
      style={{ transform: "rotate(-8deg)" }}
    >
      {label}
    </span>
  );
}
