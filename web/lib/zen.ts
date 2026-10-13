import {
  BaseError,
  ContractFunctionRevertedError,
  InsufficientFundsError,
  UserRejectedRequestError,
  createPublicClient,
  formatUnits,
  hexToString,
  http,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import { BRANDS, brandById, type Brand } from "./brands";
import type { Evidence } from "./evidence";
import { monadTestnet, txUrl } from "./chain";
import {
  brandVaultAbi,
  brandVaultFactoryAbi,
  contracts,
  eligibilityPolicyAbi,
  receiptCommitmentRegistryAbi,
  rewardPolicyAbi,
  rewardPoolAbi,
  conditionalClaimAbi,
  instantExitPoolAbi,
  voidOracleAbi,
  mockBrandAssetAbi,
} from "./contracts";
import { GAS } from "./chain";

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

// ---------------------------------------------------------------- claim model

export type PurchaseClaim = {
  claimant: Address;
  brandId: Hex;
  merchantId: Hex;
  receiptHash: Hex;
  amount: bigint;
  currency: Hex;
  purchasedAt: bigint;
  deadline: bigint;
};

export type AttestedClaim = {
  claim: PurchaseClaim;
  attestation: Hex;
  claimId: Hex;
  scheme: "ed25519" | "ecdsa";
  evidence: Evidence;
  /** Merchant-signed fields, present only for evidence === "merchant-signed". */
  receipt?: MerchantReceipt;
};

export type MerchantReceipt = {
  merchantId: string;
  merchantName: string;
  brand: string;
  receiptId: string;
  amount: string; // minor units
  currency: string;
  issuedAt: string;
  expiresAt: string;
};

/** Receipt fields the user confirms before attestation. amount is in rupees (decimal string). */
export type ReceiptInput = {
  brand: Brand["id"];
  merchant: string;
  receiptRef: string;
  amount: string;
  currency: string;
  date: string; // YYYY-MM-DD
};

/** Every ClaimStatus from src/PurchaseClaim.sol, in enum order, as product copy. */
export const CLAIM_STATUS = [
  { key: "Ok", title: "Eligible", body: "This purchase can become ownership." },
  { key: "Malformed", title: "We couldn't read this receipt", body: "Some required details are missing." },
  { key: "WrongClaimant", title: "Different wallet", body: "Connect the wallet this receipt was issued to." },
  { key: "Expired", title: "Proof expired", body: "The purchase proof is older than one hour. Create it again." },
  { key: "NullifierUsed", title: "Already used", body: "This purchase has already been used." },
  { key: "BadAttestation", title: "Not verified", body: "We couldn't verify this purchase." },
  { key: "BrandInactive", title: "Brand unavailable", body: "Zen doesn't support this brand yet." },
  { key: "CurrencyMismatch", title: "Currency not supported", body: "This brand currently accepts INR purchases only." },
  { key: "AmountOutOfRange", title: "Amount outside limits", body: "Eligible purchases are between ₹100 and ₹5,00,000." },
  { key: "PurchaseTooOld", title: "Purchase too old", body: "Purchases can be claimed within 30 days." },
  { key: "PurchaseInFuture", title: "Date looks wrong", body: "The purchase date is in the future." },
  { key: "JurisdictionBlocked", title: "Not available in your region", body: "This program isn't available for your wallet." },
  { key: "ZeroReward", title: "Purchase too small", body: "This purchase is too small to earn ownership." },
  { key: "UserDailyCapReached", title: "Daily limit reached", body: "You've reached today's limit for this brand. Try again tomorrow." },
  { key: "BrandDailyCapReached", title: "Brand limit reached", body: "Today's ownership for this brand is exhausted. Try tomorrow." },
  { key: "BudgetExhausted", title: "Rewards paused", body: "This brand's reward budget is currently empty." },
] as const;

// ---------------------------------------------------------------- formatting

/** Mock brand units have 18 decimals; by testnet convention 1 unit = ₹1 of DEMO exposure. */
export const units = (v: bigint) => Number(formatUnits(v, 18));
export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const shortAddress = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const getTransactionUrl = txUrl;

/** Reward rate as "% of purchase" under the 1 unit = ₹1 demo convention (rateWad is units-wei per paise, 1e18-scaled). */
const ratePercent = (rateWad: bigint, multiplierBps: number) =>
  Number(formatUnits(rateWad * 10_000n * BigInt(multiplierBps), 36 + 4));

// ---------------------------------------------------------------- reads

export type BrandState = Brand & {
  active: boolean;
  currency: string;
  minAmount: bigint;
  maxAmount: bigint;
  rewardPercent: number;
  perClaimCap: bigint;
  dailyUserCap: bigint;
  budget: bigint;
};

const b32 = (id: string) => stringToHex(id, { size: 32 });
const hexToAscii = (h: Hex) => hexToString(h).replace(/\0+$/, "");

export async function getSupportedBrands(): Promise<BrandState[]> {
  const calls = BRANDS.flatMap((b) => [
    { address: contracts.eligibilityPolicy, abi: eligibilityPolicyAbi, functionName: "rules", args: [b32(b.id)] } as const,
    { address: contracts.rewardPolicy, abi: rewardPolicyAbi, functionName: "config", args: [b32(b.id)] } as const,
    { address: contracts.rewardPool, abi: rewardPoolAbi, functionName: "budgetOf", args: [b32(b.id)] } as const,
  ]);
  const r = await publicClient.multicall({ contracts: calls, allowFailure: false });
  return BRANDS.map((b, i) => {
    const [active, currency, minAmount, maxAmount] = r[i * 3] as readonly [boolean, Hex, bigint, bigint];
    const [rateWad, multiplierBps, perClaimCap, dailyUserCap] = r[i * 3 + 1] as readonly [bigint, number, bigint, bigint, bigint];
    return {
      ...b,
      active,
      currency: hexToAscii(currency),
      minAmount,
      maxAmount,
      rewardPercent: ratePercent(rateWad, multiplierBps),
      perClaimCap,
      dailyUserCap,
      budget: r[i * 3 + 2] as bigint,
    };
  });
}

export type Position = Brand & { shares: bigint; assets: bigint };

export async function getUserPortfolio(user: Address): Promise<{ positions: Position[]; totalUnits: number }> {
  const balances = await publicClient.multicall({
    contracts: BRANDS.map((b) => ({ address: b.vault, abi: brandVaultAbi, functionName: "balanceOf", args: [user] }) as const),
    allowFailure: false,
  });
  const assets = await publicClient.multicall({
    contracts: BRANDS.map(
      (b, i) => ({ address: b.vault, abi: brandVaultAbi, functionName: "convertToAssets", args: [balances[i]] }) as const,
    ),
    allowFailure: false,
  });
  const positions = BRANDS.map((b, i) => ({ ...b, shares: balances[i], assets: assets[i] }));
  return { positions, totalUnits: positions.reduce((s, p) => s + units(p.assets), 0) };
}

export const getVaultBalance = async (vault: Address, user: Address) =>
  publicClient.readContract({ address: vault, abi: brandVaultAbi, functionName: "balanceOf", args: [user] });

export type ActivityItem = {
  id: bigint;
  claimant: Address;
  holder: Address;
  brand?: Brand;
  amount: bigint; // escrowed equity
  status: number; // 1 Locked, 2 Voided, 3 Settled
  unlockAt: number;
  timestamp: number; // mintedAt
};

/** Every conditional claim (or only `user`'s), newest first. Read by id enumeration, not event logs:
 *  Monad's public RPC limits eth_getLogs to 100-block ranges, so state is the source of truth. */
export async function getActivity(user?: Address): Promise<ActivityItem[]> {
  const all = await getAllClaims();
  return all
    .filter((c) => !user || c.originalClaimant.toLowerCase() === user.toLowerCase())
    .map((c) => ({
      id: c.id,
      claimant: c.originalClaimant,
      holder: c.holder,
      brand: c.brand,
      amount: c.amount,
      status: c.status,
      unlockAt: c.unlockAt,
      timestamp: c.mintedAt,
    }));
}

export type VerifierKind = "ecdsa" | "unknown";

/** On Monad the registry verifies attester signatures with the ECDSA verifier. */
export async function getActiveVerifier(): Promise<{ kind: VerifierKind; address: Address }> {
  const address = await publicClient.readContract({
    address: contracts.registry,
    abi: receiptCommitmentRegistryAbi,
    functionName: "verifier",
  });
  return { kind: address.toLowerCase() === contracts.ecdsaVerifier.toLowerCase() ? "ecdsa" : "unknown", address };
}

export const getBrandCount = () =>
  publicClient.readContract({ address: contracts.factory, abi: brandVaultFactoryAbi, functionName: "brandCount" });

// ---------------------------------------------------------------- claim flow

/** Ask the attester API to hash + sign the receipt. The browser never sees attester keys. */
export const prepareClaim = (claimant: Address, r: ReceiptInput) => attest({ claimant, ...r });

/** Merchant-signed path: the server verifies the merchant signature before attesting. */
export const prepareMerchantClaim = (claimant: Address, signedReceipt: string) => attest({ claimant, signedReceipt });

async function attest(payload: Record<string, string>): Promise<AttestedClaim> {
  const res = await fetch("/api/attest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Attestation failed");
  const c = body.claim;
  return {
    claim: {
      ...c,
      amount: BigInt(c.amount),
      purchasedAt: BigInt(c.purchasedAt),
      deadline: BigInt(c.deadline),
    },
    attestation: body.attestation,
    claimId: body.claimId,
    scheme: body.scheme,
    evidence: body.evidence,
    receipt: body.receipt,
  };
}

/** Dry run of every on-chain check (previewClaim). status indexes CLAIM_STATUS. */
export async function getClaimStatus(a: AttestedClaim): Promise<{ status: number; reward: bigint }> {
  const [status, reward] = await publicClient.readContract({
    address: contracts.registry,
    abi: receiptCommitmentRegistryAbi,
    functionName: "previewClaim",
    args: [a.claim, a.attestation],
  });
  return { status, reward };
}

export const submitClaimRequest = (a: AttestedClaim) =>
  ({
    address: contracts.registry,
    abi: receiptCommitmentRegistryAbi,
    functionName: "submitClaim",
    args: [a.claim, a.attestation],
    chainId: monadTestnet.id,
    gas: GAS.submitClaim,
  }) as const;

export type ClaimError =
  | { kind: "rejected" }
  | { kind: "funds" }
  | { kind: "status"; status: number }
  | { kind: "receipt"; message: string }
  | { kind: "other"; detail: string };

/** Turn any wallet / RPC / revert error into a product-level error. Raw detail kept for "technical details". */
export function classifyClaimError(e: unknown): ClaimError {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return { kind: "rejected" };
    if (e.walk((x) => x instanceof InsufficientFundsError)) return { kind: "funds" };
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert?.data?.errorName === "ClaimRejected") return { kind: "status", status: Number(revert.data.args?.[0]) };
    if (/user rejected|denied/i.test(e.message)) return { kind: "rejected" };
    if (/insufficient funds/i.test(e.message)) return { kind: "funds" };
    return { kind: "other", detail: e.shortMessage };
  }
  return { kind: "other", detail: e instanceof Error ? e.message : String(e) };
}

// ---------------------------------------------------------------- conditional claims

export const CLAIM_STATUS_LABEL = ["None", "Locked", "Voided", "Settled"] as const;
export const CATEGORY_LABEL: Record<number, string> = { 1: "Fashion", 2: "Electronics", 3: "Food & beverage" };

export type LockedClaim = {
  id: bigint;
  brand?: Brand;
  equityToken: Address;
  amount: bigint;
  category: number;
  status: number; // 1 Locked, 2 Voided, 3 Settled
  unlockAt: number;
  mintedAt: number;
  originalClaimant: Address;
  holder: Address;
  demoWindow: boolean;
  quote: bigint; // live instant-exit price (0 = not sellable now)
  sellableAt: number;
};

export const getClaimCount = async () =>
  Number(await publicClient.readContract({ address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "nextId" })) - 1;

/** All claims, by id enumeration (no event logs needed). */
export async function getAllClaims(): Promise<LockedClaim[]> {
  const n = await getClaimCount();
  return readClaims(Array.from({ length: n }, (_, i) => BigInt(i + 1)));
}

/** Claims `user` earned or currently holds. */
export async function getClaimsOf(user: Address): Promise<LockedClaim[]> {
  const u = user.toLowerCase();
  return (await getAllClaims()).filter((c) => c.originalClaimant.toLowerCase() === u || c.holder.toLowerCase() === u);
}

export async function readClaims(ids: bigint[]): Promise<LockedClaim[]> {
  if (!ids.length) return [];
  const base = await publicClient.multicall({
    contracts: ids.flatMap((id) => [
      { address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "claimOf", args: [id] } as const,
      { address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "ownerOf", args: [id] } as const,
    ]),
    allowFailure: false,
  });
  const claims = ids.map((id, i) => {
    const c = base[i * 2] as { equityToken: Address; category: number; status: number; unlockAt: bigint; amount: bigint; originalClaimant: Address; mintedAt: bigint; brandId: Hex };
    return { id, c, holder: base[i * 2 + 1] as Address, brand: brandById(hexToAscii(c.brandId)) };
  });
  const extra = await publicClient.multicall({
    contracts: claims.flatMap(({ id, c, brand }) => [
      { address: brand?.exitPool ?? contracts.conditionalClaim, abi: instantExitPoolAbi, functionName: "quote", args: [id] } as const,
      { address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "isDemoWindow", args: [c.category] } as const,
    ]),
    allowFailure: true,
  });
  return claims
    .map(({ id, c, holder, brand }, i) => {
      const q = extra[i * 2].result as readonly [bigint, bigint] | undefined;
      return {
        id,
        brand,
        equityToken: c.equityToken,
        amount: c.amount,
        category: c.category,
        status: c.status,
        unlockAt: Number(c.unlockAt),
        mintedAt: Number(c.mintedAt),
        originalClaimant: c.originalClaimant,
        holder,
        demoWindow: Boolean(extra[i * 2 + 1].result),
        quote: q?.[0] ?? 0n,
        sellableAt: Number(q?.[1] ?? 0n),
      };
    })
    .sort((a, b) => Number(b.id - a.id));
}

export const approveClaimRequest = (spender: Address, id: bigint) =>
  ({ address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "approve", args: [spender, id], chainId: monadTestnet.id, gas: GAS.approve }) as const;

/** minOut = quote less 1% slippage tolerance. */
export const sellClaimRequest = (pool: Address, id: bigint, quote: bigint) =>
  ({ address: pool, abi: instantExitPoolAbi, functionName: "sellClaim", args: [id, (quote * 99n) / 100n], chainId: monadTestnet.id, gas: GAS.sellClaim }) as const;

export const settleRequest = (id: bigint) =>
  ({ address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "settle", args: [id], chainId: monadTestnet.id, gas: GAS.settle }) as const;

export const voidRequest = (claimId: bigint, refundRef: Hex, deadline: bigint, sig: Hex) =>
  ({ address: contracts.voidOracle, abi: voidOracleAbi, functionName: "voidWithAttestation", args: [claimId, refundRef, deadline, sig], chainId: monadTestnet.id, gas: GAS.void }) as const;

// ---------------------------------------------------------------- LP terminal

export type PoolCategory = { category: number; pRefundBps: number; minHoldSeconds: number; enabled: boolean };
export type PoolState = {
  brand: Brand;
  pool: Address;
  totalAssets: bigint;
  idle: bigint;
  booked: bigint;
  totalSupply: bigint;
  heldCount: bigint;
  realizedGains: bigint;
  realizedLosses: bigint;
  claimsBought: bigint;
  timeValueBps: number;
  lpFeeBps: number;
  riskSlopeBps: number;
  category: PoolCategory;
  navPerShare: number; // equity per whole LP share: convertToAssets(1e24), shares have 24 decimals (offset 6)
  user?: { shares: bigint; assets: bigint; maxWithdraw: bigint; equityBalance: bigint; allowance: bigint };
};

const CATEGORY_OF: Record<string, number> = { NIKE: 1, AAPL: 2, SBUX: 3 };

export async function getPools(user?: Address): Promise<PoolState[]> {
  const fns = ["totalAssets", "idleAssets", "totalBooked", "totalSupply", "heldCount", "realizedGains", "realizedLosses", "claimsBought", "timeValueBps", "lpFeeBps", "riskSlopeBps"] as const;
  const per = fns.length + 2;
  const r = await publicClient.multicall({
    contracts: BRANDS.flatMap((b) => [
      ...fns.map((f) => ({ address: b.exitPool, abi: instantExitPoolAbi, functionName: f }) as const),
      { address: b.exitPool, abi: instantExitPoolAbi, functionName: "categoryParams", args: [CATEGORY_OF[b.id]] } as const,
      { address: b.exitPool, abi: instantExitPoolAbi, functionName: "convertToAssets", args: [10n ** 24n] } as const,
    ]),
    allowFailure: false,
  });
  const u = user
    ? await publicClient.multicall({
        contracts: BRANDS.flatMap((b) => [
          { address: b.exitPool, abi: instantExitPoolAbi, functionName: "balanceOf", args: [user] } as const,
          { address: b.exitPool, abi: instantExitPoolAbi, functionName: "maxWithdraw", args: [user] } as const,
          { address: b.equity, abi: mockBrandAssetAbi, functionName: "balanceOf", args: [user] } as const,
          { address: b.equity, abi: mockBrandAssetAbi, functionName: "allowance", args: [user, b.exitPool] } as const,
        ]),
        allowFailure: false,
      })
    : null;
  const userAssets = u
    ? await publicClient.multicall({
        contracts: BRANDS.map((b, i) => ({ address: b.exitPool, abi: instantExitPoolAbi, functionName: "convertToAssets", args: [u[i * 4] as bigint] }) as const),
        allowFailure: false,
      })
    : null;
  return BRANDS.map((b, i) => {
    const v = (k: number) => r[i * per + k];
    const [pRefundBps, minHoldSeconds, enabled] = v(fns.length) as readonly [number, bigint, boolean];
    return {
      brand: b,
      pool: b.exitPool,
      totalAssets: v(0) as bigint,
      idle: v(1) as bigint,
      booked: v(2) as bigint,
      totalSupply: v(3) as bigint,
      heldCount: v(4) as bigint,
      realizedGains: v(5) as bigint,
      realizedLosses: v(6) as bigint,
      claimsBought: v(7) as bigint,
      timeValueBps: Number(v(8)),
      lpFeeBps: Number(v(9)),
      riskSlopeBps: Number(v(10)),
      category: { category: CATEGORY_OF[b.id], pRefundBps: Number(pRefundBps), minHoldSeconds: Number(minHoldSeconds), enabled },
      navPerShare: units(v(fns.length + 1) as bigint),
      user: u
        ? {
            shares: u[i * 4] as bigint,
            assets: userAssets![i] as bigint,
            maxWithdraw: u[i * 4 + 1] as bigint,
            equityBalance: u[i * 4 + 2] as bigint,
            allowance: u[i * 4 + 3] as bigint,
          }
        : undefined,
    };
  });
}

/** Claims a pool bought (it stays the holder after resolution). cost = book cost while still Locked. */
export async function getPoolClaims(pool: Address): Promise<(LockedClaim & { cost: bigint })[]> {
  const mine = (await getAllClaims()).filter((c) => c.holder.toLowerCase() === pool.toLowerCase());
  if (!mine.length) return [];
  const costs = await publicClient.multicall({
    contracts: mine.map((c) => ({ address: pool, abi: instantExitPoolAbi, functionName: "bookCost", args: [c.id] }) as const),
    allowFailure: false,
  });
  return mine.map((c, i) => ({ ...c, cost: costs[i] as bigint }));
}

export const approveEquityRequest = (token: Address, spender: Address, amount: bigint) =>
  ({ address: token, abi: mockBrandAssetAbi, functionName: "approve", args: [spender, amount], chainId: monadTestnet.id, gas: GAS.approve }) as const;
export const depositRequest = (pool: Address, amount: bigint, receiver: Address) =>
  ({ address: pool, abi: instantExitPoolAbi, functionName: "deposit", args: [amount, receiver], chainId: monadTestnet.id, gas: GAS.deposit }) as const;
export const withdrawRequest = (pool: Address, amount: bigint, owner: Address) =>
  ({ address: pool, abi: instantExitPoolAbi, functionName: "withdraw", args: [amount, owner, owner], chainId: monadTestnet.id, gas: GAS.withdraw }) as const;
