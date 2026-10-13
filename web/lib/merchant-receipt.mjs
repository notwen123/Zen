// Merchant-signed receipt format. Browser-safe (no crypto, no keys): encode, decode and the exact
// bytes a merchant signs. Signing and verification live in merchant-pos.mjs (server only).
//
// Wire format (QR content):  SBR1.<base64url(JSON receipt)>.<base64url(64-byte Ed25519 signature)>
// The signature covers canonicalMessage(receipt): a versioned, line-per-field string in a fixed
// order. Every field is strictly validated first, so no field can smuggle a newline or "=" and
// re-shape the signed message.

export const RECEIPT_PREFIX = "SBR1";
export const MAX_VALIDITY_SECONDS = 30 * 24 * 3600;

// Fixed signing order. Changing it (or any regex) is a format version bump.
export const RECEIPT_FIELDS = [
  ["merchantId", /^[A-Z0-9][A-Z0-9-]{2,47}$/],
  ["merchantName", /^[A-Za-z0-9 ,.'&()-]{1,80}$/],
  ["brand", /^[A-Z]{2,8}$/],
  ["receiptId", /^[A-Za-z0-9-]{8,64}$/],
  ["amount", /^[1-9]\d{0,13}$/], // minor units (paise), positive integer
  ["currency", /^[A-Z]{3}$/],
  ["issuedAt", /^\d{10}$/], // unix seconds
  ["expiresAt", /^\d{10}$/],
];

export class ReceiptError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Throws ReceiptError("malformed") unless every field is present, a string, and matches its rule. */
export function assertReceiptShape(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) throw new ReceiptError("malformed", "Receipt is not an object");
  const extra = Object.keys(r).filter((k) => !RECEIPT_FIELDS.some(([f]) => f === k));
  if (extra.length) throw new ReceiptError("malformed", `Unknown receipt field: ${extra[0]}`);
  for (const [k, re] of RECEIPT_FIELDS) {
    if (typeof r[k] !== "string" || !re.test(r[k])) throw new ReceiptError("malformed", `Invalid receipt field: ${k}`);
  }
  if (Number(r.expiresAt) <= Number(r.issuedAt)) throw new ReceiptError("malformed", "Receipt expires before it was issued");
  if (Number(r.expiresAt) - Number(r.issuedAt) > MAX_VALIDITY_SECONDS) throw new ReceiptError("malformed", "Receipt validity window is too long");
  return r;
}

/** The exact UTF-8 string a merchant signs. */
export function canonicalMessage(r) {
  assertReceiptShape(r);
  return ["STOCKBACK-MERCHANT-RECEIPT-V1", ...RECEIPT_FIELDS.map(([k]) => `${k}=${r[k]}`)].join("\n");
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new ReceiptError("malformed", "Payload is not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** receipt + 64-byte signature -> QR payload string. */
export function encodeSignedReceipt(r, signature) {
  assertReceiptShape(r);
  if (signature.length !== 64) throw new ReceiptError("malformed", "Signature must be 64 bytes");
  const body = Object.fromEntries(RECEIPT_FIELDS.map(([k]) => [k, r[k]]));
  return `${RECEIPT_PREFIX}.${b64url(enc.encode(JSON.stringify(body)))}.${b64url(signature)}`;
}

/** Accepts a raw payload or a link carrying it in "#r=" / "?r=". Returns { receipt, signature }.
 *  Shape is validated; the signature is NOT checked here (see merchant-pos.mjs). */
export function decodeSignedReceipt(input) {
  if (typeof input !== "string" || input.length > 2048) throw new ReceiptError("malformed", "Not a STOCKBACK receipt");
  let s = input.trim();
  const m = s.match(/[#?&]r=([^&#\s]+)/);
  if (m) s = decodeURIComponent(m[1]);
  const parts = s.split(".");
  if (parts.length !== 3 || parts[0] !== RECEIPT_PREFIX) throw new ReceiptError("malformed", "Not a STOCKBACK receipt");
  let receipt;
  try {
    receipt = JSON.parse(dec.decode(unb64url(parts[1])));
  } catch (e) {
    if (e instanceof ReceiptError) throw e;
    throw new ReceiptError("malformed", "Receipt body is not valid JSON");
  }
  const signature = unb64url(parts[2]);
  if (signature.length !== 64) throw new ReceiptError("malformed", "Signature must be 64 bytes");
  return { receipt: assertReceiptShape(receipt), signature };
}
