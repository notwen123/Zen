// STOCKBACK demo attester core. SERVER-ONLY (node:crypto, private keys).
// Shared by the web API route (web/app/api/attest) and the CLI (tools/attester.mjs).
//
// DEMO attester: it trusts the receipt it is given. A production attester verifies the
// purchase with a merchant / payment API before signing.
//
// Receipt (off-chain) -> PII-free PurchaseClaim:
//   merchantId  = keccak256(utf8(merchant))
//   receiptHash = keccak256(abi.encode(keccak256(utf8(salt)), receiptRef))   // salted: short
//                                                                             // refs can't be brute-forced
// Signatures cover the EIP-712 digest bound to (chainId, registry):
//   ECDSA   -> 65 bytes (r||s||v)              for ECDSAAttestationVerifier
//   Ed25519 -> 96 bytes (pubkey 32 || sig 64)  for the Stylus ReceiptProver
import { createPrivateKey, createPublicKey, sign as nodeSign } from "node:crypto";
import { encodeAbiParameters, hashStruct, hashTypedData, keccak256, stringToHex } from "viem";
import { sign } from "viem/accounts";

export const CLAIM_TYPES = {
  PurchaseClaim: [
    { name: "claimant", type: "address" },
    { name: "brandId", type: "bytes32" },
    { name: "merchantId", type: "bytes32" },
    { name: "receiptHash", type: "bytes32" },
    { name: "amount", type: "uint128" },
    { name: "currency", type: "bytes3" },
    { name: "purchasedAt", type: "uint64" },
    { name: "deadline", type: "uint64" },
  ],
};

export function bytes32String(s) {
  const hex = stringToHex(s);
  if (hex.length > 66) throw new Error(`"${s}" is longer than 32 bytes`);
  return hex.padEnd(66, "0");
}

export function currencyBytes3(c) {
  if (!/^[A-Z]{3}$/.test(c)) throw new Error("currency must be ISO-4217, e.g. INR");
  return stringToHex(c);
}

/** Normalised receipt -> on-chain PurchaseClaim (hashes only). amount is minor units (paise). */
export function buildClaim(r, salt, now = Math.floor(Date.now() / 1000)) {
  return {
    claimant: r.claimant,
    brandId: bytes32String(r.brand),
    merchantId: keccak256(stringToHex(r.merchant)),
    receiptHash: keccak256(
      encodeAbiParameters([{ type: "bytes32" }, { type: "string" }], [keccak256(stringToHex(salt)), r.receiptRef]),
    ),
    amount: BigInt(r.amount),
    currency: currencyBytes3(r.currency),
    purchasedAt: BigInt(r.purchasedAt ?? now - 60),
    deadline: BigInt(now + (r.validForSeconds ?? 3600)),
  };
}

/** EIP-712 struct hash = the on-chain claim ID / commitment. */
export function claimId(claim) {
  return hashStruct({ data: claim, primaryType: "PurchaseClaim", types: CLAIM_TYPES });
}

export function claimDigest(claim, chainId, registry) {
  return hashTypedData({
    domain: { name: "STOCKBACK", version: "1", chainId, verifyingContract: registry },
    types: CLAIM_TYPES,
    primaryType: "PurchaseClaim",
    message: claim,
  });
}

function ed25519Key(seedHex) {
  const seed = Buffer.from(seedHex.replace(/^0x/, ""), "hex");
  if (seed.length !== 32) throw new Error("Ed25519 seed must be 32 bytes hex");
  const der = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]);
  const priv = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const pub = createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
  return { priv, pub };
}

export function ed25519PublicKey(seedHex) {
  return "0x" + ed25519Key(seedHex).pub.toString("hex");
}

/** 96-byte attestation for the Stylus verifier: pubkey || signature over the 32-byte digest. */
export function attestEd25519(seedHex, digest) {
  const { priv, pub } = ed25519Key(seedHex);
  const sig = nodeSign(null, Buffer.from(digest.slice(2), "hex"), priv);
  return "0x" + pub.toString("hex") + sig.toString("hex");
}

/** 65-byte attestation for ECDSAAttestationVerifier: raw signature over the digest (no prefix). */
export async function attestECDSA(privateKey, digest) {
  return sign({ hash: digest, privateKey, to: "hex" });
}

/** Tuple string accepted by `cast send ... "submitClaim((...),bytes)"`. */
export function claimTuple(c) {
  return `(${c.claimant},${c.brandId},${c.merchantId},${c.receiptHash},${c.amount},${c.currency},${c.purchasedAt},${c.deadline})`;
}
