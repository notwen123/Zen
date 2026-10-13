// Merchant receipt signing (simulated POS) and verification (attester). SERVER-ONLY (node:crypto).
//
// Trust boundary: the POS holds the merchant private key; the attester only ever sees the merchant
// PUBLIC key. A receipt is accepted only if its Ed25519 signature over canonicalMessage() verifies
// against a trusted merchant public key, so no reward-relevant field can change after signing.
import { createPrivateKey, createPublicKey, randomBytes, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { canonicalMessage, decodeSignedReceipt, encodeSignedReceipt, ReceiptError } from "./merchant-receipt.mjs";

const PKCS8_ED25519 = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");

function hex32(h, what) {
  const b = Buffer.from(String(h ?? "").replace(/^0x/, ""), "hex");
  if (b.length !== 32) throw new Error(`${what} must be 32 bytes hex`);
  return b;
}
const privKey = (seedHex) => createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, hex32(seedHex, "Merchant seed")]), format: "der", type: "pkcs8" });
const pubKey = (pubHex) => createPublicKey({ key: Buffer.concat([SPKI_ED25519, hex32(pubHex, "Merchant public key")]), format: "der", type: "spki" });

export function merchantPublicKey(seedHex) {
  return "0x" + createPublicKey(privKey(seedHex)).export({ format: "der", type: "spki" }).subarray(-32).toString("hex");
}

/** Simulated POS: builds and signs a receipt. amount is minor units (paise) as a string. */
export function issueMerchantReceipt(seedHex, { merchantId, merchantName, brand, amount, currency = "INR", validForSeconds = 24 * 3600 }, now = Math.floor(Date.now() / 1000)) {
  const receipt = {
    merchantId,
    merchantName,
    brand,
    receiptId: `R-${now.toString(36).toUpperCase()}-${randomBytes(8).toString("hex").toUpperCase()}`,
    amount: String(amount),
    currency,
    issuedAt: String(now),
    expiresAt: String(now + validForSeconds),
  };
  const signature = nodeSign(null, Buffer.from(canonicalMessage(receipt), "utf8"), privKey(seedHex));
  return { receipt, payload: encodeSignedReceipt(receipt, signature) };
}

/**
 * Attester side. Returns the verified receipt or throws ReceiptError with code:
 *   malformed | bad_signature | expired | not_yet_valid | unsupported_brand
 * @param {string} payload            QR content or link
 * @param {{ trustedKeys: string[], supportedBrands: string[], now?: number, skewSeconds?: number }} opts
 */
export function verifyMerchantReceipt(payload, { trustedKeys, supportedBrands, now = Math.floor(Date.now() / 1000), skewSeconds = 120 }) {
  if (!trustedKeys?.length) throw new Error("No trusted merchant public keys configured");
  const { receipt, signature } = decodeSignedReceipt(payload);
  const msg = Buffer.from(canonicalMessage(receipt), "utf8");
  if (!trustedKeys.some((k) => nodeVerify(null, msg, pubKey(k), signature))) {
    throw new ReceiptError("bad_signature", "Merchant signature does not match this receipt");
  }
  // Checked only after the signature, so these errors can't be used to probe unsigned edits.
  if (Number(receipt.issuedAt) > now + skewSeconds) throw new ReceiptError("not_yet_valid", "Receipt is dated in the future");
  if (Number(receipt.expiresAt) <= now) throw new ReceiptError("expired", "This receipt has expired");
  if (!supportedBrands.includes(receipt.brand)) throw new ReceiptError("unsupported_brand", "STOCKBACK doesn't support this brand");
  return receipt;
}
