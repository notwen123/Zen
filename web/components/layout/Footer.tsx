import Link from "next/link";
import { BrushStroke, Petals, Seal } from "@/components/art/Art";
import { addressUrl, GITHUB_URL, robinhoodTestnet } from "@/lib/chain";
import { contracts } from "@/lib/contracts";

const PRODUCT = [
  ["How it works", "/how-it-works"],
  ["Brands", "/supported-brands"],
  ["About", "/about"],
  ["Merchant demo", "/merchant"],
  ["Open app", "/app/dashboard"],
] as const;

const PROTOCOL = [
  ["GitHub", GITHUB_URL],
  ["Security", `${GITHUB_URL}/blob/main/SECURITY.md`],
  ["Architecture", `${GITHUB_URL}/blob/main/docs/ARCHITECTURE.md`],
  ["Benchmarks", `${GITHUB_URL}/blob/main/benchmarks/results/BENCHMARKS.md`],
] as const;

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[0.65rem] uppercase tracking-[0.26em] text-muted">{children}</p>
);

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden">
      <Petals count={6} />

      {/* sign-off */}
      <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-5 pt-16 sm:px-8 md:flex-row md:items-end md:justify-between">
        <p className="font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[1.02]">
          Scan. Prove.
          <span className="relative ml-3 inline-block">
            Own<span className="text-vermilion">.</span>
            <BrushStroke className="absolute -bottom-2 left-0 -z-10 h-3 w-full" delay={200} />
          </span>
        </p>
        <Link
          href="/app/dashboard"
          className="ink-btn inline-flex min-h-11 items-center gap-3 self-start bg-ink px-6 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.18em] text-paper md:self-auto"
        >
          Start Stockback <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* links */}
      <div className="mx-auto mt-14 grid max-w-[1320px] grid-cols-2 gap-10 border-t border-ink/10 px-5 pt-10 sm:px-8 md:grid-cols-[1fr_1fr_1.3fr]">
        <nav aria-label="Footer: product">
          <Label>Product</Label>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PRODUCT.map(([t, h]) => (
              <li key={t}>
                <Link className="ink-link" href={h}>
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Footer: protocol">
          <Label>Protocol</Label>
          <ul className="mt-4 space-y-2.5 text-sm">
            {PROTOCOL.map(([t, h]) => (
              <li key={t}>
                <a className="ink-link" href={h} target="_blank" rel="noreferrer">
                  {t} <span className="text-muted">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="col-span-2 md:col-span-1">
          <Label>Network</Label>
          <p className="mt-4 flex items-center gap-2.5 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-vermilion opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-vermilion" />
            </span>
            Live on {robinhoodTestnet.name}
          </p>
          <dl className="mt-4 space-y-1.5 font-mono text-xs text-muted">
            <div className="flex gap-3">
              <dt>Chain</dt>
              <dd className="text-ink">{robinhoodTestnet.id}</dd>
            </div>
            <div className="flex gap-3">
              <dt>Registry</dt>
              <dd>
                <a className="ink-link text-ink" href={addressUrl(contracts.registry)} target="_blank" rel="noreferrer">
                  {contracts.registry.slice(0, 6)}…{contracts.registry.slice(-4)} ↗
                </a>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt>Verifier</dt>
              <dd className="text-ink">Stylus · Ed25519</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* oversized wordmark */}
      <div aria-hidden="true" className="mt-14 select-none overflow-hidden px-2">
        <p className="whitespace-nowrap text-center font-display text-[13.4vw] font-extrabold leading-[0.78] tracking-[-0.02em] text-transparent [-webkit-text-stroke:1.2px_rgba(23,23,23,.35)] [mask-image:linear-gradient(to_bottom,black_35%,transparent)]">
          STOCKBACK
        </p>
      </div>

      {/* base line */}
      <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 pb-8 pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2.5">
          <Seal size={16} />© 2026 STOCKBACK · Demo assets on testnet. Not securities, not brand partners.
        </p>
        <a href="#main" className="ink-link self-start font-mono uppercase tracking-[0.2em] sm:self-auto">
          Back to top ↑
        </a>
      </div>
    </footer>
  );
}
