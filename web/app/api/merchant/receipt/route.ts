import "server-only";
import QRCode from "qrcode";
import { brandById } from "@/lib/brands";
import { issueMerchantReceipt } from "@/lib/merchant-pos.mjs";
import { rateLimiter } from "@/lib/rate-limit";

// SIMULATED POINT-OF-SALE. Signs receipts with a demo merchant key so the merchant-signed evidence
// path can be shown end to end. It is not a real merchant and is public by design: anyone can mint a
// demo receipt here, which is exactly why it is labelled "simulated" everywhere and why on-chain caps
// and the sponsor budget still bound rewards. In production this key lives inside the merchant's POS.

const SEED = process.env.MERCHANT_ED25519_SEED;
const limited = rateLimiter(30, 10 * 60_000);
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!SEED) return bad("Merchant demo is not configured", 503);
  // Key separation: refuse to run if the merchant key was set to the attester key.
  if (SEED.replace(/^0x/, "") === process.env.ATTESTER_ED25519_SEED?.replace(/^0x/, "")) return bad("Merchant key must differ from attester key", 503);
  if (limited(req)) return bad("Too many requests. Try again in a few minutes.", 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const brand = typeof body.brand === "string" ? brandById(body.brand) : undefined;
  if (!brand) return bad("STOCKBACK doesn't support this brand yet.", 422);
  const { amount } = body;
  if (typeof amount !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) return bad("Amount must be a number with up to 2 decimals");
  const [rupees, paise = ""] = amount.split(".");
  const minor = BigInt(rupees) * 100n + BigInt(paise.padEnd(2, "0"));
  if (minor === 0n) return bad("Amount must be greater than zero");

  try {
    const { receipt, payload } = issueMerchantReceipt(SEED, {
      merchantId: `DEMO-POS-${brand.id}-001`,
      merchantName: `${brand.merchant} (simulated)`,
      brand: brand.id,
      amount: minor.toString(),
      currency: "INR",
    });
    // Fragment, not query: the payload never reaches server logs when the link is opened.
    const link = `${new URL(req.url).origin}/app/scan#r=${payload}`;
    const qr = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#171717", light: "#00000000" } });
    return Response.json({ receipt, payload, link, qr, simulated: true });
  } catch (e) {
    console.error("merchant receipt failed", e);
    return bad("Couldn't issue the receipt.", 500);
  }
}
