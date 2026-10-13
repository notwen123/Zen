#!/usr/bin/env node
// Fails if any server-only secret value appears in what ships to browsers (client bundles,
// prerendered HTML/RSC) or in git-tracked files. Prints only file names, never values.
//   node --env-file=.env.local scripts/check-secrets.mjs      (run after `next build`)
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const web = resolve(import.meta.dirname, "..");
const root = resolve(web, "..");
const NAMES = ["ATTESTER_ED25519_SEED", "ATTESTER_ECDSA_KEY", "ATTESTER_SALT", "MERCHANT_ED25519_SEED"];
const secrets = NAMES.map((k) => [k, process.env[k]?.trim().replace(/^0x/, "").toLowerCase()]).filter(([, v]) => v && v.length >= 16);
if (secrets.length < NAMES.length) {
  console.error(`Missing secrets in env (${NAMES.length - secrets.length}); run with --env-file=.env.local`);
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
