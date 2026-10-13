#!/usr/bin/env node
// Fails if any server-only secret value appears in what ships to browsers (client bundles,
// prerendered HTML/RSC) or in git-tracked files. Prints only file names, never values.
//   node --env-file=.env.local scripts/check-secrets.mjs      (run after `next build`)
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const web = resolve(import.meta.dirname, "..");
const root = resolve(web, "..");
// ATTESTER_ECDSA_KEY signs claim and refund attestations; MERCHANT_ED25519_SEED is optional (simulated POS).
const REQUIRED = ["ATTESTER_ECDSA_KEY", "ATTESTER_SALT"];
const NAMES = [...REQUIRED, "MERCHANT_ED25519_SEED", "FAUCET_PRIVATE_KEY"];
const secrets = NAMES.map((k) => [k, process.env[k]?.trim().replace(/^0x/, "").toLowerCase()]).filter(([, v]) => v && v.length >= 16);
if (REQUIRED.some((k) => !secrets.some(([n]) => n === k))) {
  console.error("Missing ATTESTER_ECDSA_KEY or ATTESTER_SALT in env; run with --env-file=.env.local");
  process.exit(2);
}

function* walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}
const browserFiles = [...walk(join(web, ".next/static")), ...[...walk(join(web, ".next/server/app"))].filter((p) => /\.(html|rsc|body|meta)$/.test(p))];
const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean).map((f) => join(root, f));

let hits = 0;
for (const [label, files] of [["browser-facing build output", browserFiles], ["git-tracked files", tracked]]) {
  let scanned = 0;
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f, "utf8").toLowerCase();
    } catch {
      continue;
    }
    scanned++;
    for (const [name, v] of secrets) {
      if (text.includes(v)) {
        hits++;
        console.log(`LEAK  ${name} found in ${f}`);
      }
    }
  }
  console.log(`scanned ${scanned} ${label}`);
}
console.log(hits ? `FAIL  ${hits} secret occurrence(s)` : `PASS  no secret values in ${secrets.length} checked secrets`);
process.exit(hits ? 1 : 0);
