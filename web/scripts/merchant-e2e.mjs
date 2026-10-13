#!/usr/bin/env node
// Integration test for the merchant-signed receipt path against a RUNNING server and the LIVE
// Robinhood testnet deployment. Never prints secrets.
//
//   node --env-file=.env.local scripts/merchant-e2e.mjs
//   env: BASE (default http://localhost:3200)
//        BASE_NOKEY  optional server started WITHOUT attester/merchant keys -> failure-path checks
//        CLAIMANT_KEY optional funded testnet key -> submits a real claim on-chain
import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, decodeEventLog, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { issueMerchantReceipt } from "../lib/merchant-pos.mjs";
import { decodeSignedReceipt, encodeSignedReceipt } from "../lib/merchant-receipt.mjs";
import { receiptCommitmentRegistryAbi } from "../lib/generated/abis.ts";
import { deployment } from "../lib/generated/deployment.ts";

const BASE = process.env.BASE ?? "http://localhost:3200";
const SECRETS = ["ATTESTER_ED25519_SEED", "ATTESTER_ECDSA_KEY", "ATTESTER_SALT", "MERCHANT_ED25519_SEED"]
  .map((k) => process.env[k]?.replace(/^0x/, "").toLowerCase())
  .filter(Boolean);
const chain = { id: 46630, name: "Robinhood Chain Testnet", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } } };
const pub = createPublicClient({ chain, transport: http() });

let pass = 0, fail = 0, skip = 0;
const ok = (name, cond, extra = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
};
const skipped = (name, why) => (skip++, console.log(`SKIP  ${name}  (${why})`));

async function post(base, path, body) {
  const res = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  const leaked = SECRETS.some((s) => text.toLowerCase().includes(s));
  if (leaked) ok(`no secret in ${path} response`, false);
  return { status: res.status, body: JSON.parse(text), leaked };
}
function tamper(payload, field, value) {
  const { receipt, signature } = decodeSignedReceipt(payload);
  return encodeSignedReceipt({ ...receipt, [field]: value }, signature);
}

const rawKey = process.env.CLAIMANT_KEY?.trim().replace(/^["']|["']$/g, "");
const claimantKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;
const claimant = privateKeyToAccount(claimantKey ?? generatePrivateKey());

// 1. Simulated POS issues a signed receipt
const pos = await post(BASE, "/api/merchant/receipt", { brand: "NIKE", amount: "2000" });
ok("POS issues signed receipt", pos.status === 200 && pos.body.payload?.startsWith("SBR1.") && pos.body.qr?.includes("<svg") && pos.body.simulated === true, `status ${pos.status}`);
const payload = pos.body.payload;
ok("POS response carries no key material", !pos.leaked && !("seed" in pos.body));
ok("POS rejects unsupported brand", (await post(BASE, "/api/merchant/receipt", { brand: "TSLA", amount: "10" })).status === 422);

// 2. Attester verifies the merchant signature, then attests
const good = await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: payload });
ok("valid merchant receipt is attested", good.status === 200 && good.body.evidence === "merchant-signed", `status ${good.status} ${good.body.error ?? ""}`);
ok("claim amount/brand come from the signed receipt", good.body.claim?.amount === "200000" && good.body.claim?.brandId?.startsWith("0x4e494b45"));

// 3. Tampering and bad signatures
for (const [field, value] of [["amount", "9900000"], ["brand", "AAPL"], ["receiptId", "R-FORGED-0000000000000000"], ["issuedAt", String(Math.floor(Date.now() / 1000) - 5)]]) {
  const r = await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: tamper(payload, field, value) });
  ok(`tampered ${field} rejected`, r.status === 401 && r.body.code === "bad_signature", `status ${r.status}`);
}
const { receipt } = decodeSignedReceipt(payload);
ok("garbage signature rejected", (await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: encodeSignedReceipt(receipt, randomBytes(64)) })).status === 401);
const wrongKey = issueMerchantReceipt(randomBytes(32).toString("hex"), { merchantId: "DEMO-POS-NIKE-001", merchantName: "Nike Store 042, Mumbai (simulated)", brand: "NIKE", amount: "200000" });
ok("receipt signed by wrong key rejected", (await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: wrongKey.payload })).status === 401);
ok("malformed payload rejected", (await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: "SBR1.nope.nope" })).status === 400);
ok("non-string payload rejected", (await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: 42 })).status === 400);

const seed = process.env.MERCHANT_ED25519_SEED;
if (seed) {
  const old = Math.floor(Date.now() / 1000) - 2 * 86400;
  const expired = issueMerchantReceipt(seed, { merchantId: "DEMO-POS-NIKE-001", merchantName: "Nike Store 042, Mumbai (simulated)", brand: "NIKE", amount: "200000", validForSeconds: 600 }, old);
  const r = await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: expired.payload });
  ok("expired receipt rejected", r.status === 410 && r.body.code === "expired", `status ${r.status}`);
  const tsla = issueMerchantReceipt(seed, { merchantId: "DEMO-POS-TSLA-001", merchantName: "Tesla (simulated)", brand: "TSLA", amount: "200000" });
  const u = await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: tsla.payload });
  ok("validly signed unsupported brand rejected", u.status === 422 && u.body.code === "unsupported_brand", `status ${u.status}`);
} else {
  skipped("expired / unsupported-brand signed receipts", "MERCHANT_ED25519_SEED not in env");
}

// 4. On-chain: every registry check passes for the attested claim
const toClaim = (c) => ({ ...c, amount: BigInt(c.amount), purchasedAt: BigInt(c.purchasedAt), deadline: BigInt(c.deadline) });
const claim = toClaim(good.body.claim);
const [status, reward] = await pub.readContract({ address: deployment.registry, abi: receiptCommitmentRegistryAbi, functionName: "previewClaim", args: [claim, good.body.attestation] });
ok("registry previewClaim accepts the claim (Stylus Ed25519 + eligibility)", status === 0 && reward > 0n, `status ${status}, reward ${reward}`);

// 5. Real claim on Robinhood testnet, then replay must fail
if (claimantKey) {
  const wallet = createWalletClient({ account: claimant, chain, transport: http() });
  const hash = await wallet.writeContract({ address: deployment.registry, abi: receiptCommitmentRegistryAbi, functionName: "submitClaim", args: [claim, good.body.attestation] });
  const rc = await pub.waitForTransactionReceipt({ hash });
  let assets;
  for (const log of rc.logs) {
    try {
      const ev = decodeEventLog({ abi: receiptCommitmentRegistryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "RewardAllocated") assets = ev.args.assets;
    } catch {}
  }
  ok("merchant-signed claim settled on Robinhood testnet", rc.status === "success" && assets > 0n, `tx ${hash}, assets ${assets}`);

  const again = await post(BASE, "/api/attest", { claimant: claimant.address, signedReceipt: payload });
  ok("duplicate receipt rejected after claim (same wallet)", again.status === 409 && again.body.code === "already_claimed", `status ${again.status}`);
  const other = await post(BASE, "/api/attest", { claimant: privateKeyToAccount(generatePrivateKey()).address, signedReceipt: payload });
  ok("duplicate receipt rejected after claim (different wallet)", other.status === 409, `status ${other.status}`);
} else {
  skipped("on-chain claim + duplicate rejection", "CLAIMANT_KEY not set");
}

// 6. Attester / merchant failure paths on a server started without keys
if (process.env.BASE_NOKEY) {
  const N = process.env.BASE_NOKEY;
  ok("POS without merchant key fails closed (503)", (await post(N, "/api/merchant/receipt", { brand: "NIKE", amount: "10" })).status === 503);
  ok("merchant path without merchant public key fails closed (503)", (await post(N, "/api/attest", { claimant: claimant.address, signedReceipt: payload })).status === 503);
  const manual = await post(N, "/api/attest", { claimant: claimant.address, brand: "NIKE", merchant: "Nike Store", receiptRef: "INV-123", amount: "2000", currency: "INR", date: "2026-10-01" });
  ok("attester without signing key fails closed (503, no attestation)", manual.status === 503 && !manual.body.attestation, `status ${manual.status}`);
} else {
  skipped("attester failure paths", "BASE_NOKEY not set");
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped`);
process.exit(fail ? 1 : 0);
