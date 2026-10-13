"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Arrow, Button, ButtonLink, Eyebrow } from "@/components/ui/Button";
import { BRANDS, brandById } from "@/lib/brands";
import { EVIDENCE } from "@/lib/evidence";
import type { MerchantReceipt } from "@/lib/stockback";

type Issued = { receipt: MerchantReceipt; payload: string; link: string; qr: string };

const time = (s: string) => new Date(Number(s) * 1000).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** Simulated point-of-sale. The merchant key stays on the server; this page only asks it to sign. */
export function MerchantPos() {
  const [brand, setBrand] = useState("NIKE");
  const [amount, setAmount] = useState("2000");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [issued, setIssued] = useState<Issued>();
  const [copied, setCopied] = useState(false);

  async function issue() {
    setBusy(true);
    setError(undefined);
    setCopied(false);
    try {
      const res = await fetch("/api/merchant/receipt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brand, amount }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't issue the receipt");
      setIssued(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const b = brandById(issued?.receipt.brand ?? brand)!;

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-24 pt-16 sm:px-8">
      <div className="border border-vermilion/50 bg-vermilion/5 px-4 py-3 text-sm text-vermilion-deep" role="note">
        <strong>Simulated merchant.</strong> This point-of-sale is part of the STOCKBACK demo. It is not run by, or affiliated with, any brand shown. Receipts are signed with a demo
        merchant key and rewards are testnet demo assets.
      </div>

      <header className="mt-12 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <Eyebrow>Merchant point-of-sale · simulated</Eyebrow>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,5.5vw,4.6rem)] font-extrabold leading-[0.98]">Ring up a sale. Print a signed receipt.</h1>
          <p className="mt-5 max-w-xl text-charcoal">
            The till signs every field (merchant, brand, receipt ID, amount, time, expiry) with its own key. Change any of them and the signature no longer matches.
          </p>
        </div>
      </header>

      <div className="mt-12 grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        {/* till */}
        <section aria-label="New sale" className="border-t border-ink/15 pt-8">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">New sale</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">Brand</span>
              <select className="mt-1.5 w-full border-b border-ink/30 bg-transparent py-2 outline-none focus:border-vermilion" value={brand} onChange={(e) => setBrand(e.target.value)}>
                {BRANDS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} (demo)
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">Amount (₹)</span>
              <input
                className="tabular mt-1.5 w-full border-b border-ink/30 bg-transparent py-2 outline-none focus:border-vermilion"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
            </label>
          </div>
          <p className="mt-6 text-sm text-muted">
            Store: {brandById(brand)?.merchant} (simulated) · Currency INR · Receipt valid 24 hours
          </p>
          <Button className="mt-8" onClick={issue} disabled={busy || !amount}>
            {busy ? "Signing…" : "Issue signed receipt"} <Arrow />
          </Button>
          {error && (
            <p className="mt-4 text-sm text-vermilion-deep" role="alert">
              {error}
            </p>
          )}
          <div className="mt-12 border-l-2 border-ink pl-4">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">What this proves · tier {EVIDENCE["merchant-signed"].tier}</p>
            <p className="mt-1 font-semibold">{EVIDENCE["merchant-signed"].label}</p>
            <p className="mt-1 text-sm text-muted">{EVIDENCE["merchant-signed"].body}</p>
          </div>
        </section>

        {/* printed receipt */}
        <section aria-label="Signed receipt" aria-live="polite">
          <AnimatePresence mode="wait">
            {issued ? (
              <motion.div
                key={issued.receipt.receiptId}
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative mx-auto max-w-md bg-[#FBF8F1] px-7 pb-10 pt-7 font-mono text-[0.75rem] shadow-[0_40px_60px_-36px_rgba(23,23,23,.5)]"
              >
                <span className="absolute right-3 top-3 border border-vermilion/50 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.18em] text-vermilion-deep">Simulated</span>
                <div className="flex justify-center">
                  <BrandMark brand={b} className="h-9 w-14" />
                </div>
                <p className="mt-2 text-center font-display text-2xl font-extrabold tracking-[0.25em]">{b.name.toUpperCase()}</p>
                <p className="mt-1 text-center text-[0.62rem] uppercase tracking-[0.14em] text-muted">{issued.receipt.merchantName}</p>
                <div className="my-4 border-t border-dashed border-ink/30" />
                <Row k="Merchant" v={issued.receipt.merchantId} />
                <Row k="Receipt" v={issued.receipt.receiptId} />
                <Row k="Issued" v={time(issued.receipt.issuedAt)} />
                <Row k="Expires" v={time(issued.receipt.expiresAt)} />
                <div className="my-4 border-t border-dashed border-ink/30" />
                <div className="flex justify-between text-base font-medium">
                  <span>TOTAL</span>
                  <span className="tabular">₹{(Number(issued.receipt.amount) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="mx-auto mt-6 w-56" role="img" aria-label="QR code of the signed receipt" dangerouslySetInnerHTML={{ __html: issued.qr }} />
                <p className="mt-3 text-center text-[0.6rem] uppercase tracking-[0.18em] text-muted">Scan with STOCKBACK · Ed25519 signed</p>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid min-h-[420px] place-items-center border border-dashed border-ink/20 p-10 text-center text-sm text-muted">
                The signed receipt and its QR print here.
              </motion.div>
            )}
          </AnimatePresence>

          {issued && (
            <div className="mx-auto mt-8 flex max-w-md flex-wrap gap-3">
              <ButtonLink href={`/app/scan#r=${issued.payload}`}>
                Claim in STOCKBACK <Arrow />
              </ButtonLink>
              <Button
                variant="ghost"
                onClick={() => navigator.clipboard?.writeText(issued.link).then(() => setCopied(true), () => {})}
              >
                {copied ? "Link copied" : "Copy receipt link"}
              </Button>
              <details className="w-full text-xs text-muted">
                <summary className="cursor-pointer">Signed payload</summary>
                <p className="mt-2 break-all font-mono">{issued.payload}</p>
              </details>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 py-0.5">
    <span className="uppercase text-muted">{k}</span>
    <span className="truncate text-right">{v}</span>
  </div>
);
