#!/usr/bin/env node
// Seeds real Monad testnet activity against deployments/10143.json:
//   3 shopper wallets make ~20 verified purchases across fashion / electronics / food,
//   an LP wallet funds the three InstantExitPools, ~8 locked claims are sold to the pools,
//   2 are voided by refund attestations (one of them pool-held: the LP-loss path),
//   and every other claim is settled after its (labelled, 5-10 minute) demo return window.
// Every tx hash is written to deployments/10143-activity.json.
//
// Monad charges the gas LIMIT, so every tx uses estimateGas * 1.15 instead of a fat default.
//
// Env (root .env.local / web/.env.local, never committed):
//   PRIVATE_KEY          deployer: funds wallets, owns the mock equity tokens
//   ATTESTER_ECDSA_KEY   signs purchase claims and refund attestations
//   SEED_KEYS            optional, comma-separated: 4 keys (3 shoppers + 1 LP); generated if absent
// Usage: node --env-file=.env.local --env-file=web/.env.local script/seed-activity.mjs [--resume]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const { createPublicClient, createWalletClient, http, parseEther, keccak256, toHex, stringToHex, pad } = require("viem");
const { privateKeyToAccount, generatePrivateKey } = require("viem/accounts");

const ROOT = new URL("../", import.meta.url).pathname;
const RPC = process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
const CHAIN = { id: 10143, name: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const D = JSON.parse(readFileSync(`${ROOT}deployments/10143.json`, "utf8"));
const OUT = `${ROOT}deployments/10143-activity.json`;
const abi = (n) => JSON.parse(readFileSync(`${ROOT}out/${n}.sol/${n}.json`, "utf8")).abi;
const A = {
  registry: abi("ReceiptCommitmentRegistry"), claim: abi("ConditionalClaim"), oracle: abi("VoidOracle"),
  pool: abi("InstantExitPool"), erc20: abi("MockBrandAsset"),
};

const pub = createPublicClient({ chain: CHAIN, transport: http(RPC, { retryCount: 5, retryDelay: 400 }) });
const key = (k) => (k.startsWith("0x") ? k : `0x${k}`);
const deployer = privateKeyToAccount(key(process.env.PRIVATE_KEY));
const attester = privateKeyToAccount(key(process.env.ATTESTER_ECDSA_KEY));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// wallets: reuse SEED_KEYS so --resume works across runs
let seedKeys = (process.env.SEED_KEYS || "").split(",").filter(Boolean);
if (seedKeys.length < 4) {
  seedKeys = [0, 1, 2, 3].map(() => generatePrivateKey());
  appendFileSync(`${ROOT}.env.local`, `\nSEED_KEYS=${seedKeys.join(",")}\n`);
  console.log("generated 4 seed wallets (keys appended to git-ignored .env.local)");
}
const [s0, s1, s2, lpAcct] = seedKeys.map((k) => privateKeyToAccount(key(k)));
const shoppers = [s0, s1, s2];

const log = existsSync(OUT) && process.argv.includes("--resume") ? JSON.parse(readFileSync(OUT, "utf8")) : {
  chainId: 10143, network: "Monad testnet", explorer: "https://testnet.monadvision.com",
  note: "Seeded demo activity. Mock tokenized-equity assets; simulated merchant; demo return windows of 5-10 minutes.",
  wallets: { deployer: deployer.address, shoppers: shoppers.map((a) => a.address), lp: lpAcct.address },
  txs: [],
};
const save = () => writeFileSync(OUT, JSON.stringify(log, null, 2) + "\n");

async function send(account, address, abi_, functionName, args = [], label = functionName, value) {
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC, { retryCount: 5, retryDelay: 400 }) });
  const est = await pub.estimateContractGas({ account, address, abi: abi_, functionName, args, value });
  const hash = await wallet.writeContract({ address, abi: abi_, functionName, args, value, gas: (est * 115n) / 100n });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  log.txs.push({ action: label, from: account.address, hash, gasLimit: Number((est * 115n) / 100n), gasUsed: Number(rc.gasUsed) });
  save();
  console.log(`${label.padEnd(34)} ${hash}`);
  return rc;
}

async function sendMon(to, amount, label) {
  const wallet = createWalletClient({ account: deployer, chain: CHAIN, transport: http(RPC) });
  const hash = await wallet.sendTransaction({ to, value: amount, gas: 21000n });
  await pub.waitForTransactionReceipt({ hash });
  log.txs.push({ action: label, from: deployer.address, hash });
  save();
  console.log(`${label.padEnd(34)} ${hash}`);
}

const BRANDS = [
  { id: "NIKE", sym: "mNKE", label: "fashion", amounts: [2_499_00, 4_999_00, 1_899_00, 7_499_00, 3_299_00, 2_999_00, 5_499_00] },
  { id: "AAPL", sym: "mAAPL", label: "electronics", amounts: [14_990_00, 9_999_00, 19_900_00, 7_990_00, 12_499_00, 4_990_00, 8_499_00] },
  { id: "SBUX", sym: "mSBUX", label: "food", amounts: [450_00, 380_00, 620_00, 295_00, 510_00, 720_00] },
];
const MINTED = keccak256(toHex("ClaimMinted(uint256,address,bytes32,address,uint256,uint8,uint64)"));
const b32 = (s) => pad(stringToHex(s), { dir: "right", size: 32 });

const domain = (name, contract) => ({ name, version: "1", chainId: 10143, verifyingContract: contract });
const CLAIM_TYPES = { PurchaseClaim: [
  { name: "claimant", type: "address" }, { name: "brandId", type: "bytes32" }, { name: "merchantId", type: "bytes32" },
  { name: "receiptHash", type: "bytes32" }, { name: "amount", type: "uint128" }, { name: "currency", type: "bytes3" },
  { name: "purchasedAt", type: "uint64" }, { name: "deadline", type: "uint64" },
] };
const REFUND_TYPES = { RefundAttestation: [
  { name: "claimId", type: "uint256" }, { name: "refundRef", type: "bytes32" }, { name: "deadline", type: "uint64" },
] };

async function main() {
  console.log("deployer", deployer.address, "attester", attester.address);
  const now = () => BigInt(Math.floor(Date.now() / 1000));

  // 1. gas for the seed wallets
  for (const a of [...shoppers, lpAcct]) {
    if ((await pub.getBalance({ address: a.address })) < parseEther("0.15")) await sendMon(a.address, parseEther("0.3"), "fund wallet with MON");
  }

  // 2. LP funds each exit pool with mock equity
  for (const b of BRANDS) {
    const asset = D[`${b.sym}Asset`], xp = D[`${b.sym}ExitPool`];
    if ((await pub.readContract({ address: xp, abi: A.pool, functionName: "totalSupply" })) > 0n) continue;
    const amt = parseEther("2000");
    await send(deployer, asset, A.erc20, "mint", [lpAcct.address, amt], `mint ${b.sym} to LP (mock)`);
    await send(lpAcct, asset, A.erc20, "approve", [xp, amt], `LP approve ${b.sym} pool`);
    await send(lpAcct, xp, A.pool, "deposit", [amt, lpAcct.address], `LP deposit ${b.sym} pool`);
  }

  // 3. ~20 verified purchases -> locked conditional claims (resumable: skips purchases already made)
  log.claims ||= [];
  const claims = log.claims;
  {
    let i = 0;
    for (const b of BRANDS) {
      for (const amount of b.amounts) {
        if (i < claims.length) { i++; continue; }
        const who = shoppers[i % 3];
        const c = {
          claimant: who.address, brandId: b32(b.id), merchantId: keccak256(stringToHex(`merchant:demo-${b.id.toLowerCase()}-store`)),
          receiptHash: keccak256(toHex(`seed-receipt-${b.id}-${i}-${Date.now()}`)), amount: BigInt(amount),
          currency: stringToHex("INR", { size: 3 }), purchasedAt: now() - 60n, deadline: now() + 3600n,
        };
        const sig = await attester.signTypedData({ domain: domain("Zen", D.registry), types: CLAIM_TYPES, primaryType: "PurchaseClaim", message: c });
        const rc = await send(who, D.registry, A.registry, "submitClaim", [c, sig], `purchase ${b.label} (${b.id}) -> claim`);
        const minted = rc.logs.find((l) => l.address.toLowerCase() === D.conditionalClaim.toLowerCase() && l.topics[0] === MINTED);
        claims.push({ id: Number(BigInt(minted.topics[1])), brand: b.id, sym: b.sym, owner: who.address, shopper: i % 3, mintedLocal: Date.now() });
        save();
        i++;
      }
    }
  }

  const unlockOf = async (c) => Number((await pub.readContract({ address: D.conditionalClaim, abi: A.claim, functionName: "claimOf", args: [BigInt(c.id)] })).unlockAt);
  const lockedLongEnough = async (c, margin) => (await unlockOf(c)) > Number(now()) + margin;

  // 4. sell 8 still-locked claims to the pools (after the 60 s demo min-hold), spread across brands
  const newest = Math.max(...claims.map((c) => c.mintedLocal || 0));
  if (Date.now() - newest < 65_000) { console.log("waiting for the min-hold..."); await sleep(65_000); }
  let sold = claims.filter((c) => c.sold).length;
  for (const c of [...claims].reverse()) {
    if (sold >= 8) break;
    if (c.sold || c.voided || c.settled || !(await lockedLongEnough(c, 90))) continue;
    if (claims.filter((x) => x.sold && x.brand === c.brand).length >= 3) continue;
    const who = shoppers[c.shopper], xp = D[`${c.sym}ExitPool`];
    await send(who, D.conditionalClaim, A.claim, "approve", [xp, BigInt(c.id)], `approve claim #${c.id} to pool`);
    const [price] = await pub.readContract({ address: xp, abi: A.pool, functionName: "quote", args: [BigInt(c.id)] });
    await send(who, xp, A.pool, "sellClaim", [BigInt(c.id), (price * 99n) / 100n], `cash out claim #${c.id} (${c.brand})`);
    c.sold = true;
    c.price = price.toString();
    sold++;
    save();
  }

  // 5. two refunds before unlock: one pool-held claim (LP loss) and one still held by the shopper
  const voidTargets = [
    claims.find((c) => c.sold && !c.voided && !c.settled && c.brand !== "SBUX") || claims.find((c) => c.sold && !c.voided),
    [...claims].reverse().find((c) => !c.sold && !c.voided && !c.settled),
  ];
  for (const c of voidTargets) {
    if (!c || c.voided || claims.filter((x) => x.voided).length >= 2) continue;
    if (!(await lockedLongEnough(c, 20))) continue;
    const refundRef = keccak256(toHex(`refund:${c.brand}:${c.id}:${Date.now()}`));
    const deadline = now() + 900n;
    const sig = await attester.signTypedData({ domain: domain("Zen VoidOracle", D.voidOracle), types: REFUND_TYPES, primaryType: "RefundAttestation", message: { claimId: BigInt(c.id), refundRef, deadline } });
    await send(deployer, D.voidOracle, A.oracle, "voidWithAttestation", [BigInt(c.id), refundRef, deadline, sig], `refund voids claim #${c.id}${c.sold ? " (LP loss)" : ""}`);
    c.voided = true;
    save();
  }

  // 6. settle the rest once their windows close (anyone may call settle)
  for (const c of claims) {
    if (c.voided || c.settled) continue;
    const info = await pub.readContract({ address: D.conditionalClaim, abi: A.claim, functionName: "claimOf", args: [BigInt(c.id)] });
    const wait = Number(info.unlockAt) - Number(now()) + 3;
    if (wait > 0) { console.log(`waiting ${wait}s for claim #${c.id} to unlock...`); await sleep(wait * 1000); }
    await send(shoppers[(c.shopper + 1) % 3], D.conditionalClaim, A.claim, "settle", [BigInt(c.id)], `settle claim #${c.id}${c.sold ? " (pool gain)" : ""}`);
    c.settled = true;
    save();
  }
  console.log(`done: ${log.txs.length} transactions -> ${OUT}`);
}

main().catch((e) => { console.error(e.shortMessage || e.message); process.exit(1); });
