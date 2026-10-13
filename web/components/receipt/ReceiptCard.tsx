import { BrandMark } from "@/components/brand/BrandMark";
import { brandById } from "@/lib/brands";
import type { ReceiptInput } from "@/lib/stockback";

const fmtDate = (d: string) => {
  const t = Date.parse(`${d}T12:00:00Z`);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
};

/** Paper receipt rendering of the (normalised) receipt fields. */
export function ReceiptCard({ r, className, demo, signed }: { r: Partial<ReceiptInput>; className?: string; demo?: boolean; signed?: boolean }) {
  const b = r.brand ? brandById(r.brand) : undefined;
  const amount = Number(r.amount || 0);
  return (
    <div className={`relative bg-[#FBF8F1] px-6 pb-8 pt-6 font-mono text-[0.75rem] text-ink shadow-[0_30px_50px_-30px_rgba(23,23,23,.45)] ${className ?? ""}`}>
      {signed && (
        <span className="absolute left-3 top-3 border border-ink/40 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.18em]">Merchant-signed · simulated</span>
      )}
      {demo && (
        <span className="absolute right-3 top-3 border border-vermilion/50 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-[0.18em] text-vermilion-deep">Demo</span>
      )}
      {b && (
        <div className="mb-3 flex justify-center">
          <BrandMark brand={b} className="h-10 w-16" />
        </div>
      )}
      <p className="text-center font-display text-3xl font-extrabold tracking-[0.25em]">{b?.name.toUpperCase() ?? "RECEIPT"}</p>
      <p className="mt-1 text-center text-[0.62rem] uppercase tracking-[0.16em] text-muted">{r.merchant || "—"}</p>
      <div className="my-4 border-t border-dashed border-ink/30" />
      <Row k="Date" v={r.date ? fmtDate(r.date) : "—"} />
      <Row k="Receipt" v={r.receiptRef || "—"} />
      <Row k="Currency" v={r.currency || "INR"} />
      <div className="my-4 border-t border-dashed border-ink/30" />
      <div className="flex justify-between text-base font-medium">
        <span>TOTAL</span>
        <span className="tabular">₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="absolute -bottom-2 left-0 right-0 h-3 bg-[radial-gradient(circle_at_6px_0,transparent_5px,#FBF8F1_5.5px)] bg-[length:12px_12px]" aria-hidden="true" />
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-4 py-0.5">
    <span className="uppercase text-muted">{k}</span>
    <span className="truncate text-right">{v}</span>
  </div>
);
