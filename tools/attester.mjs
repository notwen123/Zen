#!/usr/bin/env node
// STOCKBACK demo attester CLI. DEMO ONLY: it trusts the receipt JSON it is given.
// All hashing/signing lives in web/lib/attester-core.mjs (shared with the web API route);
// run `npm ci --prefix web` once so its `viem` dependency resolves.
//
// Usage:
//   node tools/attester.mjs attest receipt.json   (env: CHAIN_ID, REGISTRY, ATTESTER_SALT,
//                                                  ATTESTER_ECDSA_KEY and/or ATTESTER_ED25519_SEED)
//   node tools/attester.mjs pubkey                (env: ATTESTER_ED25519_SEED)
//   node tools/attester.mjs vector                (deterministic test vector for Rust tests)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  attestECDSA,
  attestEd25519,
  buildClaim,
  claimDigest,
  claimId,
  claimTuple,
  ed25519PublicKey,
} from "../web/lib/attester-core.mjs";

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

async function attest(file) {
  const claim = buildClaim(JSON.parse(readFileSync(file, "utf8")), need("ATTESTER_SALT"));
  const digest = claimDigest(claim, Number(need("CHAIN_ID")), need("REGISTRY"));
  const out = {
    claim: Object.fromEntries(Object.entries(claim).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])),
    claimId: claimId(claim),
    digest,
    tuple: claimTuple(claim),
  };
  if (process.env.ATTESTER_ECDSA_KEY) out.attestationECDSA = await attestECDSA(process.env.ATTESTER_ECDSA_KEY, digest);
  if (process.env.ATTESTER_ED25519_SEED) out.attestationEd25519 = attestEd25519(process.env.ATTESTER_ED25519_SEED, digest);
  console.log(JSON.stringify(out, null, 2));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "attest") await attest(arg);
else if (cmd === "pubkey") console.log(ed25519PublicKey(need("ATTESTER_ED25519_SEED")));
else if (cmd === "vector") {
  const seed = "01".repeat(32);
  const digest = "0x" + createHash("sha256").update("stockback-test-vector").digest("hex");
  const att = attestEd25519(seed, digest);
  console.log(JSON.stringify({ seed, pubkey: att.slice(0, 66), digest, signature: "0x" + att.slice(66) }, null, 2));
} else {
  console.error("usage: attester.mjs attest <receipt.json> | pubkey | vector");
  process.exit(1);
}
