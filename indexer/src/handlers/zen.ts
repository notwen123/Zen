import { indexer, type Account, type Pool } from "envio";
import { POOL_BRAND } from "../pools";

// Zen on Monad: claims, cash-outs, refunds, settlements and LP flows, each with its tx hash, so the app
// no longer needs eth_getLogs (Monad's public RPC caps it at 100 blocks).

const ascii = (hex: string) =>
  Buffer.from(hex.replace(/^0x/, ""), "hex").toString("utf8").replace(/\0+$/, "");
const id = (e: { transaction: { hash: string }; logIndex: number }) => `${e.transaction.hash}-${e.logIndex}`;
const lc = (a: string) => a.toLowerCase();

type AccountStore = { Account: { get: (id: string) => Promise<Account | undefined> } };
type PoolStore = { Pool: { get: (id: string) => Promise<Pool | undefined> } };

async function account(context: AccountStore, who: string): Promise<Account> {
  return (await context.Account.get(lc(who))) ?? { id: lc(who), claims: 0, voids: 0, cashOuts: 0, lpDeposits: 0n };
}

async function pool(context: PoolStore, address: string): Promise<Pool> {
  const a = lc(address);
  return (
    (await context.Pool.get(a)) ?? {
      id: a,
      brand: POOL_BRAND[a] ?? "UNKNOWN",
      deposited: 0n,
      withdrawn: 0n,
      claimsBought: 0,
      boughtFace: 0n,
      boughtCost: 0n,
      realizedGains: 0n,
      realizedLosses: 0n,
      settledCount: 0,
      voidedCount: 0,
    }
  );
}

// ---------------------------------------------------------------- purchases -> claims

// PurchaseCommitted precedes ClaimMinted in the same tx; store it as an entity keyed by tx hash (handlers may
// run twice under V3 preload optimization, so no in-memory state).
indexer.onEvent({ contract: "ReceiptCommitmentRegistry", event: "PurchaseCommitted" }, async ({ event, context }) => {
  context.Purchase.set({
    id: event.transaction.hash,
    amount: event.params.amount,
    currency: ascii(event.params.currency),
    claimant: lc(event.params.claimant),
  });
});

indexer.onEvent({ contract: "ConditionalClaim", event: "ClaimMinted" }, async ({ event, context }) => {
  const p = event.params;
  const purchase = await context.Purchase.get(event.transaction.hash);
  const brand = ascii(p.brandId);
  context.Claim.set({
    id: p.id.toString(),
    claimant: lc(p.claimant),
    holder: lc(p.claimant),
    brand,
    equityToken: lc(p.equityToken),
    amount: p.amount,
    category: Number(p.category),
    unlockAt: p.unlockAt,
    status: "LOCKED",
    mintedAt: BigInt(event.block.timestamp),
    mintTx: event.transaction.hash,
    purchaseAmount: purchase?.amount,
    currency: purchase?.currency,
    sold: false,
    salePrice: undefined,
    saleTx: undefined,
    refundRef: undefined,
    resolvedAt: undefined,
    resolvedTx: undefined,
    poolCost: undefined,
    poolProceeds: undefined,
  });
  const a = await account(context, p.claimant);
  context.Account.set({ ...a, claims: a.claims + 1 });
  context.Activity.set({
    id: id(event), kind: "CLAIM", account: lc(p.claimant), claimId: p.id.toString(), brand, amount: p.amount, price: undefined,
    pool: undefined, timestamp: BigInt(event.block.timestamp), blockNumber: event.block.number, txHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "ConditionalClaim", event: "Transfer" }, async ({ event, context }) => {
  const c = await context.Claim.get(event.params.tokenId.toString());
  if (c) context.Claim.set({ ...c, holder: lc(event.params.to) });
});

// ---------------------------------------------------------------- resolution

indexer.onEvent({ contract: "VoidOracle", event: "RefundAccepted" }, async ({ event, context }) => {
  const c = await context.Claim.get(event.params.claimId.toString());
  if (c) context.Claim.set({ ...c, refundRef: event.params.refundRef });
});

indexer.onEvent({ contract: "ConditionalClaim", event: "ClaimVoided" }, async ({ event, context }) => {
  const p = event.params;
  const c = await context.Claim.get(p.id.toString());
  if (c) context.Claim.set({ ...c, status: "VOIDED", resolvedAt: BigInt(event.block.timestamp), resolvedTx: event.transaction.hash });
  const a = await account(context, p.originalClaimant);
  context.Account.set({ ...a, voids: a.voids + 1 });
  context.Activity.set({
    id: id(event), kind: "REFUND", account: lc(p.originalClaimant), claimId: p.id.toString(), brand: c?.brand, amount: p.amount,
    price: undefined, pool: undefined, timestamp: BigInt(event.block.timestamp), blockNumber: event.block.number, txHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "ConditionalClaim", event: "ClaimSettled" }, async ({ event, context }) => {
  const p = event.params;
  const c = await context.Claim.get(p.id.toString());
  if (c) context.Claim.set({ ...c, status: "SETTLED", resolvedAt: BigInt(event.block.timestamp), resolvedTx: event.transaction.hash });
  context.Activity.set({
    id: id(event), kind: "SETTLE", account: lc(p.holder), claimId: p.id.toString(), brand: c?.brand, amount: p.amount,
    price: undefined, pool: undefined, timestamp: BigInt(event.block.timestamp), blockNumber: event.block.number, txHash: event.transaction.hash,
  });
});

// ---------------------------------------------------------------- the exit market

indexer.onEvent({ contract: "InstantExitPool", event: "ClaimBought" }, async ({ event, context }) => {
  const p = event.params;
  const c = await context.Claim.get(p.id.toString());
  if (c) context.Claim.set({ ...c, sold: true, salePrice: p.price, saleTx: event.transaction.hash, poolCost: p.price });
  const pl = await pool(context, event.srcAddress);
  context.Pool.set({ ...pl, claimsBought: pl.claimsBought + 1, boughtFace: pl.boughtFace + p.amount, boughtCost: pl.boughtCost + p.price });
  const a = await account(context, p.seller);
  context.Account.set({ ...a, cashOuts: a.cashOuts + 1 });
  context.Activity.set({
    id: id(event), kind: "CASH_OUT", account: lc(p.seller), claimId: p.id.toString(), brand: pl.brand, amount: p.amount, price: p.price,
    pool: lc(event.srcAddress), timestamp: BigInt(event.block.timestamp), blockNumber: event.block.number, txHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "InstantExitPool", event: "ClaimResolved" }, async ({ event, context }) => {
  const p = event.params;
  const pl = await pool(context, event.srcAddress);
  const gain = p.settled && p.proceeds > p.cost ? p.proceeds - p.cost : 0n;
  const loss = !p.settled ? p.cost : p.proceeds < p.cost ? p.cost - p.proceeds : 0n;
  context.Pool.set({
    ...pl,
    realizedGains: pl.realizedGains + gain,
    realizedLosses: pl.realizedLosses + loss,
    settledCount: pl.settledCount + (p.settled ? 1 : 0),
    voidedCount: pl.voidedCount + (p.settled ? 0 : 1),
  });
  const c = await context.Claim.get(p.id.toString());
  if (c) context.Claim.set({ ...c, poolProceeds: p.proceeds });
});

indexer.onEvent({ contract: "InstantExitPool", event: "Deposit" }, async ({ event, context }) => {
  const p = event.params;
  const pl = await pool(context, event.srcAddress);
  context.Pool.set({ ...pl, deposited: pl.deposited + p.assets });
  const a = await account(context, p.owner);
  context.Account.set({ ...a, lpDeposits: a.lpDeposits + p.assets });
  context.Activity.set({
    id: id(event), kind: "LP_DEPOSIT", account: lc(p.owner), claimId: undefined, brand: pl.brand, amount: p.assets, price: undefined,
    pool: lc(event.srcAddress), timestamp: BigInt(event.block.timestamp), blockNumber: event.block.number, txHash: event.transaction.hash,
  });
});

indexer.onEvent({ contract: "InstantExitPool", event: "Withdraw" }, async ({ event, context }) => {
  const p = event.params;
  const pl = await pool(context, event.srcAddress);
  context.Pool.set({ ...pl, withdrawn: pl.withdrawn + p.assets });
  context.Activity.set({
    id: id(event), kind: "LP_WITHDRAW", account: lc(p.owner), claimId: undefined, brand: pl.brand, amount: p.assets, price: undefined,
    pool: lc(event.srcAddress), timestamp: BigInt(event.block.timestamp), blockNumber: event.block.number, txHash: event.transaction.hash,
  });
});
