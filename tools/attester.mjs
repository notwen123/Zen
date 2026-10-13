#!/usr/bin/env node
// Zen demo attester CLI. DEMO ONLY: it trusts the receipt JSON it is given.
// All hashing/signing lives in web/lib/attester-core.mjs (shared with the web API route);
// run `npm ci --prefix web` once so its `viem` dependency resolves.
//
// Usage:
//   node tools/attester.mjs attest receipt.json   (env: CHAIN_ID, REGISTRY, ATTESTER_SALT, ATTESTER_ECDSA_KEY)
import { readFileSync } from "node:fs";
import { attestECDSA, buildClaim, claimDigest, claimId, claimTuple } from "../web/lib/attester-core.mjs";

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

async function attest(file) {
  const claim = buildClaim(JSON.parse(readFileSync(file, "utf8")), need("ATTESTER_SALT"));
  const digest = claimDigest(claim, Number(need("CHAIN_ID")), need("REGISTRY"));
  console.log(
    JSON.stringify(
      {
        claim: Object.fromEntries(Object.entries(claim).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v])),
        claimId: claimId(claim),
        digest,
        tuple: claimTuple(claim),
        attestation: await attestECDSA(need("ATTESTER_ECDSA_KEY"), digest),
      },
      null,
      2,
    ),
  );
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "attest") await attest(arg);
else {
  console.error("usage: attester.mjs attest <receipt.json>");
  process.exit(1);
}
