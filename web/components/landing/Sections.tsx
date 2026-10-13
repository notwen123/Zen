import Image from "next/image";
import Link from "next/link";
import { Petals } from "@/components/art/Art";
import { BrandMark } from "@/components/brand/BrandMark";
import { Reveal, RevealLines } from "@/components/motion/Motion";
import { Arrow, ButtonLink, Eyebrow } from "@/components/ui/Button";
import { BRANDS } from "@/lib/brands";
import { getOnchainBenchmark } from "@/lib/benchmarks";
import { GITHUB_URL } from "@/lib/chain";
import { EVIDENCE } from "@/lib/evidence";
import { LivePortfolioPreview } from "./LivePortfolioPreview";

function SectionHead({ eyebrow, title, className }: { eyebrow: string; title: React.ReactNode[]; className?: string }) {
  return (
    <div className={className}>
      <Reveal>
        <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />
          {eyebrow}
        </p>
      </Reveal>
      <h2 className="mt-6 font-display text-[clamp(2.3rem,5.4vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.01em]">
        <RevealLines lines={title} />
      </h2>
    </div>
  );
}

const Wrap = ({ children, className, id, label }: { children: React.ReactNode; className?: string; id?: string; label: string }) => (
  <section id={id} aria-label={label} className={`relative mx-auto max-w-[1320px] px-5 sm:px-8 ${className ?? ""}`}>
    {children}
  </section>
);

const fmt = (n: number) => n.toLocaleString("en-US");

const CAP = 32_000_000; // Robinhood testnet maxTxGasLimit (ArbGasInfo), read on-chain
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : `${Math.round(n / 1e3)}k`);

export async function StylusSection() {
  const bench = await getOnchainBenchmark();
  const best = bench?.rows.reduce((m, r) => (r.solidity && r.stylus ? Math.max(m, r.solidity / r.stylus) : m), 0) ?? 0;
  const top = CAP * 1.18;
  return (
    <div className="relative text-paper">
      {/* the ink section rises out of a mountain ridge instead of a hard slide edge */}
      <svg aria-hidden="true" viewBox="0 0 1440 140" preserveAspectRatio="none" className="block h-24 w-full sm:h-32">
        <path d="M0 140V96l120-34 110 22 140-58 120 46 110-28 150-40 130 52 120-24 140 38 110-30 160 26 110-12v92z" fill="var(--stockback-ink)" opacity=".25" />
        <path d="M0 140v-30l160-36 120 28 150-44 130 40 140-26 120 18 150-50 140 46 120-20 150 30 140-14v58z" fill="var(--stockback-ink)" />
      </svg>
      <div className="bg-ink">
      <Wrap label="Why Stylus" className="py-16 sm:py-20">
        <div className="grid items-end gap-16 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Reveal>
              <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.24em] text-stone">
                <span className="h-1.5 w-1.5 rounded-full bg-vermilion" />
                Why Stylus
              </p>
            </Reveal>
            <h2 className="mt-6 font-display text-[clamp(2.3rem,4.6vw,4rem)] font-bold leading-[1.02]">
              <RevealLines lines={["Verified in Rust."]} />
            </h2>
            {bench ? (
              <Reveal delay={0.2} className="mt-10">
                <p className="font-display text-[clamp(5rem,12vw,9rem)] font-extrabold leading-none tabular">
                  {best.toFixed(1)}
                  <span className="text-vermilion">×</span>
                </p>
                <p className="mt-3 max-w-xs text-paper/75">less gas than Solidity to verify Ed25519 signatures.</p>
              </Reveal>
            ) : (
              <p className="mt-10 font-display text-3xl">Benchmark in progress</p>
            )}
          </div>

          {bench && (
            <Reveal delay={0.15}>
              <figure aria-label="Gas used to verify 1, 10, 50 and 100 signatures, Solidity versus Stylus">
                <div className="relative h-[300px] border-b border-paper/20">
                  {/* per-transaction gas cap */}
                  <div className="absolute inset-x-0 border-t border-dashed border-paper/35" style={{ bottom: `${(CAP / top) * 100}%` }}>
                    <span className="absolute -top-5 left-0 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-stone">32M tx limit</span>
                  </div>
                  <div className="absolute inset-0 grid grid-cols-4 items-end gap-4 px-2 sm:gap-8 sm:px-6">
                    {bench.rows.map((r) => (
                      <div key={r.batch} className="flex h-full items-end justify-center gap-1.5 sm:gap-2.5">
                        <Column value={r.solidity} top={top} tone="stone" label={`Solidity, ${r.batch} signatures`} />
                        <Column value={r.stylus} top={top} tone="red" label={`Stylus, ${r.batch} signatures`} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-4 px-2 text-center font-mono text-xs text-stone sm:gap-8 sm:px-6">
                  {bench.rows.map((r) => (
                    <span key={r.batch}>{r.batch}</span>
                  ))}
                </div>
                <figcaption className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-stone">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 bg-stone" />Solidity</span>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 bg-vermilion" />Stylus</span>
                  <span className="normal-case tracking-normal">signatures per tx · Robinhood testnet ·{" "}
                    <a className="ink-link text-paper" href={`${GITHUB_URL}/blob/main/benchmarks/results/BENCHMARKS.md`} target="_blank" rel="noreferrer">data</a>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          )}
        </div>
      </Wrap>
      </div>
      <svg aria-hidden="true" viewBox="0 0 1440 140" preserveAspectRatio="none" className="block h-24 w-full -scale-y-100 sm:h-32">
        <path d="M0 140V96l120-34 110 22 140-58 120 46 110-28 150-40 130 52 120-24 140 38 110-30 160 26 110-12v92z" fill="var(--stockback-ink)" opacity=".25" />
        <path d="M0 140v-30l160-36 120 28 150-44 130 40 140-26 120 18 150-50 140 46 120-20 150 30 140-14v58z" fill="var(--stockback-ink)" />
      </svg>
    </div>
  );
}

/** One gas column. Null = did not fit in a transaction: drawn hatched, breaking through the cap line. */
function Column({ value, top, tone, label }: { value: number | null; top: number; tone: "stone" | "red"; label: string }) {
  const h = value ? Math.max((value / top) * 100, 1.2) : 100;
  return (
    <div className="group relative flex h-full w-5 items-end sm:w-8" title={`${label}: ${value ? fmt(value) + " gas" : "exceeds the 32M tx limit"}`}>
      <div
        className={`w-full origin-bottom transition-transform duration-500 group-hover:scale-x-110 ${
          !value
            ? "bg-[repeating-linear-gradient(45deg,rgba(184,176,162,.55)_0_5px,transparent_5px_10px)]"
            : tone === "red"
              ? "bg-vermilion"
              : "bg-stone"
        }`}
        style={{ height: `${h}%` }}
      />
      <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[0.6rem] text-paper opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {value ? compact(value) : "✕"}
      </span>
    </div>
  );
}

export function Ownership() {
  return (
    <Wrap id="ownership" label="Ownership" className="py-24 sm:py-32">
      <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <SectionHead eyebrow="Not points" title={["Own the brands", "you buy."]} />
          <ul className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
            {BRANDS.map((b, i) => (
              <Reveal as="li" key={b.id} delay={i * 0.1}>
                <div className="group flex items-center gap-6 py-5">
                  <BrandMark brand={b} className="h-9 w-14 transition-transform duration-500 group-hover:-translate-y-0.5" />
                  <span className="font-display text-3xl font-extrabold tracking-[0.04em]">{b.name}</span>
                  <span className="ml-auto text-right font-mono text-[0.65rem] uppercase tracking-[0.18em] text-muted">
                    {b.share}
                    <span className="block text-vermilion-deep">demo asset</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </ul>
          <p className="mt-6 max-w-md text-xs leading-relaxed text-muted">
            One ERC-4626 vault per brand. Testnet assets are fictional demo tokens, not securities, and not affiliated with these brands.
          </p>
        </div>
        <Reveal delay={0.15}>
          <LivePortfolioPreview />
        </Reveal>
      </div>
    </Wrap>
  );
}

/** What each kind of proof actually establishes. Kept honest on purpose. */
export function Evidence() {
  return (
    <Wrap label="Evidence" className="py-16 sm:py-24">
      <SectionHead eyebrow="Evidence" title={["Not every proof", "proves the same thing."]} />
      <ol className="mt-12 grid gap-px bg-ink/10 md:grid-cols-3">
        {Object.values(EVIDENCE).map((e, i) => (
          <Reveal as="li" key={e.label} delay={i * 0.08} className={`bg-paper p-7 ${e.status === "Roadmap" ? "text-muted" : ""}`}>
            <div className="flex items-center justify-between">
              <span className="font-display text-5xl font-extrabold text-vermilion/90">{e.tier}</span>
              <span className={`border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${e.status === "Roadmap" ? "border-dashed border-ink/30" : "border-ink/40 text-ink"}`}>{e.status}</span>
            </div>
            <p className="mt-6 font-display text-xl font-bold text-ink">{e.label}</p>
            <p className="mt-2 text-sm leading-relaxed">{e.body}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal>
        <Link className="ink-link mt-8 inline-block font-mono text-xs uppercase tracking-[0.18em]" href="/merchant">
          Try the simulated merchant POS →
        </Link>
      </Reveal>
    </Wrap>
  );
}

export function Security() {
  const items = ["One claim per receipt", "Capped rewards", "On-chain eligibility", "Merchant signatures checked", "Admin-less vaults", "Testnet only"];
  return (
    <Wrap label="Security" className="py-16 sm:py-20">
      <div className="flex flex-col gap-8 border-y border-ink/15 py-10 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-xs font-display text-2xl font-bold leading-tight">Evidence, verification and ownership, kept apart.</p>
        <ul className="flex flex-wrap gap-x-8 gap-y-4">
          {items.map((t, i) => (
            <Reveal as="li" key={t} delay={i * 0.06} className="flex items-center gap-2.5 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-full border border-vermilion text-[0.7rem] text-vermilion" aria-hidden="true">✓</span>
              {t}
            </Reveal>
          ))}
        </ul>
        <a className="ink-link shrink-0 font-mono text-xs uppercase tracking-[0.18em]" href={`${GITHUB_URL}/blob/main/SECURITY.md`} target="_blank" rel="noreferrer">
          Security model ↗
        </a>
      </div>
    </Wrap>
  );
}

export function FinalCta() {
  return (
    <section aria-label="Get started" className="relative isolate overflow-hidden">
      {/* light ink landscape: blossoms frame the left, mountains the right, the statement sits in the open sky */}
      <Image
        src="/art/cta-sky.webp"
        alt=""
        fill
        sizes="100vw"
        className="-z-10 object-cover object-center opacity-90 [mask-image:linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,.25)_12%,black_32%,black_68%,rgba(0,0,0,.25)_88%,transparent_100%)]"
      />
      <Petals count={18} />
      <div className="mx-auto flex min-h-[640px] max-w-[860px] flex-col items-center justify-center px-5 py-28 text-center sm:px-8 lg:min-h-[720px]">
        <h2 className="font-display text-[clamp(2.4rem,5vw,4.4rem)] font-extrabold leading-[1]">
          <RevealLines lines={["Your next receipt", "could be your next", <span key="own">ownership<span className="text-vermilion">.</span></span>]} />
        </h2>
        <Reveal delay={0.3} className="mt-10 flex flex-wrap justify-center gap-4">
          <ButtonLink href="/app/dashboard">
            Start Stockback <Arrow />
          </ButtonLink>
          <ButtonLink href="/about" variant="ghost" className="bg-paper/70 backdrop-blur-sm">
            Read the protocol
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}

export { Eyebrow };
