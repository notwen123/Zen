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
import { robinhoodTestnet, txUrl } from "./chain";
import {
  FROM_BLOCK,
  brandVaultAbi,
  brandVaultFactoryAbi,
  contracts,
  eligibilityPolicyAbi,
  receiptCommitmentRegistryAbi,
  rewardPolicyAbi,
  rewardPoolAbi,
} from "./contracts";

export const publicClient = createPublicClient({ chain: robinhoodTestnet, transport: http() });

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
  { key: "BrandInactive", title: "Brand unavailable", body: "STOCKBACK doesn't support this brand yet." },
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
  claimId: Hex;
  claimant: Address;
  txHash: Hex;
  brand?: Brand;
  purchaseAmountPaise: bigint;
  currency: string;
  assets: bigint;
  shares: bigint;
  timestamp: number;
};

/** Claims settled by `user` (or by everyone when omitted), from registry events since the deployment block. */
export async function getActivity(user?: Address): Promise<ActivityItem[]> {
  const args = user ? { claimant: user } : undefined;
  const [committed, allocated] = await Promise.all([
    publicClient.getContractEvents({
      address: contracts.registry,
      abi: receiptCommitmentRegistryAbi,
      eventName: "PurchaseCommitted",
      args,
      fromBlock: FROM_BLOCK,
    }),
    publicClient.getContractEvents({
      address: contracts.registry,
      abi: receiptCommitmentRegistryAbi,
      eventName: "RewardAllocated",
      args,
      fromBlock: FROM_BLOCK,
    }),
  ]);
  const byClaim = new Map(allocated.map((l) => [l.args.claimId, l]));
  const blocks = [...new Set(committed.map((l) => l.blockNumber))];
  const times = new Map(
    await Promise.all(
      blocks.map(async (n) => [n, Number((await publicClient.getBlock({ blockNumber: n })).timestamp)] as const),
    ),
  );
  return committed
    .map((l) => {
      const a = byClaim.get(l.args.claimId);
      return {
        claimId: l.args.claimId!,
        claimant: l.args.claimant!,
        txHash: l.transactionHash,
        brand: brandById(hexToAscii(l.args.brandId!)),
        purchaseAmountPaise: l.args.amount!,
        currency: hexToAscii(l.args.currency!),
        assets: a?.args.assets ?? 0n,
        shares: a?.args.shares ?? 0n,
        timestamp: times.get(l.blockNumber) ?? 0,
      };
    })
    .sort((x, y) => y.timestamp - x.timestamp);
}

export type VerifierKind = "stylus" | "ecdsa" | "unknown";

export async function getActiveVerifier(): Promise<{ kind: VerifierKind; address: Address }> {
  const address = await publicClient.readContract({
    address: contracts.registry,
    abi: receiptCommitmentRegistryAbi,
    functionName: "verifier",
  });
  const kind =
    address.toLowerCase() === contracts.stylusVerifier.toLowerCase()
      ? "stylus"
      : address.toLowerCase() === contracts.ecdsaVerifier.toLowerCase()
        ? "ecdsa"
        : "unknown";
  return { kind, address };
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
    chainId: robinhoodTestnet.id,
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
