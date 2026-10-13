#!/usr/bin/env node
// Deterministic benchmark fixtures: 100 distinct 32-byte digests, each signed by one Ed25519
// key (seed 0x01*32) and one secp256k1 key (Anvil account #1, public test key). Output is
// consumed by the forge benchmark and by run_onchain.sh, so both sides see identical inputs.
import { createPrivateKey, createPublicKey, sign, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const N = 100;
const seed = Buffer.alloc(32, 1);
const priv = createPrivateKey({
  key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
  format: "der",
  type: "pkcs8",
});
const pub = createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
const ECDSA_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // anvil #1

const digests = [], ed25519 = [], ecdsa = [];
for (let i = 0; i < N; i++) {
  const d = createHash("sha256").update(`stockback-bench-${i}`).digest();
  digests.push("0x" + d.toString("hex"));
  ed25519.push("0x" + pub.toString("hex") + sign(null, d, priv).toString("hex"));
  ecdsa.push(execFileSync("cast", ["wallet", "sign", "--no-hash", "--private-key", ECDSA_KEY, digests[i]], { encoding: "utf8" }).trim());
}
const ecdsaSigner = execFileSync("cast", ["wallet", "address", "--private-key", ECDSA_KEY], { encoding: "utf8" }).trim();
const out = { ed25519Pubkey: "0x" + pub.toString("hex"), ecdsaSigner, digests, ed25519, ecdsa };
writeFileSync(new URL("./fixtures/vectors.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(`wrote ${N} vectors`);
