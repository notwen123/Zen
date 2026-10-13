import "server-only";
import { isAddress, getAddress } from "viem";
import { attestECDSA, attestEd25519, buildClaim, claimDigest, claimId } from "@/lib/attester-core.mjs";
import { BRANDS, brandById } from "@/lib/brands";
import { robinhoodTestnet } from "@/lib/chain";
import { contracts, receiptCommitmentRegistryAbi } from "@/lib/contracts";
import { verifyMerchantReceipt } from "@/lib/merchant-pos.mjs";
import { ReceiptError } from "@/lib/merchant-receipt.mjs";
import { rateLimiter } from "@/lib/rate-limit";
import { CLAIM_STATUS, getActiveVerifier, publicClient } from "@/lib/stockback";

// DEMO ATTESTER. Two evidence paths (see docs/SECURITY.md, "Evidence tiers"):
//   1. signedReceipt: a merchant-signed receipt. The attester verifies the Ed25519 signature against
//      the merchant PUBLIC key before signing; every reward field comes from the signed receipt.
//   2. manual fields (photo/OCR or typed): the attester signs what the user confirmed. Purchase
//      authenticity is NOT independently established.
// Either way rewards stay bounded on-chain by per-claim / daily caps, the sponsor budget and the
// per-receipt nullifier.

const SEED = process.env.ATTESTER_ED25519_SEED;
const ECDSA_KEY = process.env.ATTESTER_ECDSA_KEY as `0x${string}` | undefined;
const SALT = process.env.ATTESTER_SALT;
const MERCHANT_PUB = process.env.MERCHANT_ED25519_PUBLIC_KEY;

const limited = rateLimiter(20, 10 * 60_000);
const NULLIFIER_USED = CLAIM_STATUS.findIndex((s) => s.key === "NullifierUsed");

// Active verifier is read from chain so the scheme always matches what the registry will check.
let verifierCache: { kind: string; at: number } | undefined;
async function activeScheme(): Promise<"ed25519" | "ecdsa"> {
  if (!verifierCache || Date.now() - verifierCache.at > 60_000) {
    verifierCache = { kind: (await getActiveVerifier()).kind, at: Date.now() };
  }
  if (verifierCache.kind === "stylus") return "ed25519";
  if (verifierCache.kind === "ecdsa") return "ecdsa";
  throw new Error("Registry verifier is not a known STOCKBACK verifier");
}

const bad = (error: string, status = 400, code?: string) => Response.json({ error, code }, { status });

const RECEIPT_ERRORS: Record<string, [number, string]> = {
  malformed: [400, "This QR code isn't a valid STOCKBACK receipt."],
  bad_signature: [401, "The merchant signature doesn't match this receipt. It may have been altered."],
  expired: [410, "This receipt has expired. Ask the merchant for a new one."],
  not_yet_valid: [400, "This receipt is dated in the future."],
  unsupported_brand: [422, "STOCKBACK doesn't support this brand yet."],
};

type Receipt = { brand: string; merchant: string; receiptRef: string; amount: bigint; currency: string; purchasedAt: number; validFor: number };

export async function POST(req: Request) {
  if (!SALT || (!SEED && !ECDSA_KEY)) return bad("Attester is not configured", 503);
  if (limited(req)) return bad("Too many requests. Try again in a few minutes.", 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const { claimant } = body;
  if (typeof claimant !== "string" || !isAddress(claimant)) return bad("A valid wallet address is required");

  const now = Math.floor(Date.now() / 1000);
  let r: Receipt;
  let evidence: "merchant-signed" | "attested-entry";
  let verifiedReceipt: Record<string, string> | undefined;

  if (body.signedReceipt !== undefined) {
    // ---- Tier 1: merchant-signed receipt
    if (!MERCHANT_PUB) return bad("Merchant receipts are not enabled on this server", 503);
    if (typeof body.signedReceipt !== "string") return bad(RECEIPT_ERRORS.malformed[1], RECEIPT_ERRORS.malformed[0], "malformed");
    try {
      verifiedReceipt = verifyMerchantReceipt(body.signedReceipt, { trustedKeys: [MERCHANT_PUB], supportedBrands: BRANDS.map((b) => b.id), now });
    } catch (e) {
      if (e instanceof ReceiptError) {
        const [status, msg] = RECEIPT_ERRORS[e.code] ?? RECEIPT_ERRORS.malformed;
        return bad(msg, status, e.code);
      }
      console.error("merchant verify failed", e);
      return bad("Couldn't verify the merchant receipt.", 500);
    }
    const v = verifiedReceipt!;
    evidence = "merchant-signed";
    r = {
      brand: v.brand,
      merchant: v.merchantId,
      // Namespaced by merchant so two merchants' receipt IDs can never share a nullifier.
      receiptRef: `${v.merchantId}:${v.receiptId}`,
      amount: BigInt(v.amount),
      currency: v.currency,
      // The registry rejects future purchases; never later than a minute ago.
      purchasedAt: Math.min(Number(v.issuedAt), now - 60),
      // The on-chain claim can't outlive the receipt.
      validFor: Math.min(3600, Number(v.expiresAt) - now),
    };
  } else {
    // ---- Tier 2: user-confirmed fields (photo/OCR or typed)
    const { brand, merchant, receiptRef, amount, currency, date } = body as Record<string, string>;
    const b = typeof brand === "string" ? brandById(brand) : undefined;
    if (!b) return bad("STOCKBACK doesn't support this brand yet.", 422);
    if (typeof merchant !== "string" || !merchant.trim() || merchant.length > 80) return bad("Merchant name is required (max 80 characters)");
    if (typeof receiptRef !== "string" || !/^[A-Za-z0-9#/_.:-]{3,64}$/.test(receiptRef.trim()))
      return bad("Receipt ID must be 3-64 letters, numbers or - _ . / # :");
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return bad("Currency must be a 3-letter code like INR");
    if (typeof amount !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(amount)) return bad("Amount must be a number with up to 2 decimals");
    const [rupees, paise = ""] = amount.split(".");
    const amountMinor = BigInt(rupees) * 100n + BigInt(paise.padEnd(2, "0"));
    if (amountMinor === 0n) return bad("Amount must be greater than zero");
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
      return bad("Date must be YYYY-MM-DD");
    evidence = "attested-entry";
    r = {
      brand: b.id,
      merchant: merchant.trim(),
      receiptRef: receiptRef.trim(),
      amount: amountMinor,
      currency,
      // Noon UTC of the purchase date, never later than a minute ago (the contract rejects future purchases).
      purchasedAt: Math.min(Math.floor(Date.parse(`${date}T12:00:00Z`) / 1000), now - 60),
      validFor: 3600,
    };
  }

  try {
    const scheme = await activeScheme();
    const claim = buildClaim({ claimant: getAddress(claimant), ...r, validForSeconds: r.validFor }, SALT, now);
    const digest = claimDigest(claim, robinhoodTestnet.id, contracts.registry);
    const attestation =
      scheme === "ed25519" ? (SEED ? attestEd25519(SEED, digest) : null) : ECDSA_KEY ? await attestECDSA(ECDSA_KEY, digest) : null;
    if (!attestation) return bad(`Attester has no ${scheme} key configured`, 503);

    if (evidence === "merchant-signed") {
      // Reject receipt IDs already used on-chain (the registry would revert anyway; this fails early).
      const [status] = await publicClient.readContract({
        address: contracts.registry,
        abi: receiptCommitmentRegistryAbi,
        functionName: "previewClaim",
        args: [claim as never, attestation as `0x${string}`],
      });
      if (status === NULLIFIER_USED) return bad("This receipt has already been claimed.", 409, "already_claimed");
    }

    return Response.json({
      claim: Object.fromEntries(Object.entries(claim).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])),
      claimId: claimId(claim),
      attestation,
      scheme,
      evidence,
      receipt: verifiedReceipt,
      demo: true,
    });
  } catch (e) {
    console.error("attest failed", e);
    return bad("Attestation failed. Please try again.", 500);
  }
}
