// Heuristic receipt text -> fields. Pure, no imports (checked by receipt-parse.test.mjs).
// OCR output is noisy; every field stays editable by the user before attestation.

export type ParsedReceipt = {
  brand?: "NIKE" | "AAPL" | "SBUX";
  merchant?: string;
  amount?: string; // rupees, "2000" or "2000.50"
  date?: string; // YYYY-MM-DD
  receiptRef?: string;
};

const BRAND_WORDS: [ParsedReceipt["brand"], RegExp][] = [
  ["NIKE", /\bNIKE\b/i],
  ["AAPL", /\b(APPLE|IPHONE|MACBOOK|IPAD)\b/i],
  ["SBUX", /\b(STARBUCKS|SBUX)\b/i],
];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pad = (n: number) => String(n).padStart(2, "0");

function money(s: string): number | undefined {
  const n = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseReceipt(text: string): ParsedReceipt {
  const out: ParsedReceipt = {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const upper = text.toUpperCase();

  for (const [id, re] of BRAND_WORDS) if (re.test(upper)) { out.brand = id; break; }

  // Merchant: a line mentioning STORE / a known brand word (first match)
  const m = lines.find((l) => /\b(STORE|OUTLET|CAFE)\b/i.test(l) && l.length <= 60);
  if (m) out.merchant = m.replace(/\s+/g, " ");

  // Amount: prefer a TOTAL / AMOUNT line; else the largest currency-looking number.
  const num = /(?:₹|RS\.?|INR)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  const totalLine = [...lines].reverse().find((l) => /\b(GRAND\s+)?TOTAL\b|\bAMOUNT\s+PAID\b|\bNET\s+AMOUNT\b/i.test(l) && !/SUB\s*TOTAL/i.test(l));
  const candidates = (totalLine ? [totalLine] : lines.filter((l) => /₹|RS\.?|INR/i.test(l)))
    .flatMap((l) => [...l.matchAll(num)].map((x) => money(x[1])))
    .filter((n): n is number => n !== undefined && n < 1e8);
  if (candidates.length) {
    const v = Math.max(...candidates);
    out.amount = Number.isInteger(v) ? String(v) : v.toFixed(2);
  }

  // Date: 28 SEP 2026 | 28/09/2026 | 2026-09-28
  let d = upper.match(/\b(\d{1,2})[\s-]?(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*[\s,-]*(\d{4})\b/);
  if (d) out.date = `${d[3]}-${pad(MONTHS.indexOf(d[2]) + 1)}-${pad(+d[1])}`;
  else if ((d = upper.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) out.date = `${d[1]}-${d[2]}-${d[3]}`;
  else if ((d = upper.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/))) out.date = `${d[3]}-${pad(+d[2])}-${pad(+d[1])}`; // DD/MM/YYYY (India)

  // Receipt / invoice / UPI reference
  const r = upper.match(/\b(?:INV(?:OICE)?|BILL|RECEIPT|ORDER|TXN|UPI\s*REF|REF)\s*(?:NO\.?|#|:)?\s*[:#]?\s*([A-Z0-9][A-Z0-9/-]{3,40})/);
  if (r) out.receiptRef = r[1];

  return out;
}
