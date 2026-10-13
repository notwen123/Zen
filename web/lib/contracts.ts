import type { Address } from "viem";
import { deployment } from "./generated/deployment";
export * from "./generated/abis";

/** Live Robinhood testnet addresses, generated from deployments/46630.json (npm run sync-contracts). */
export const contracts = {
  registry: deployment.registry as Address,
  eligibilityPolicy: deployment.eligibilityPolicy as Address,
  rewardPolicy: deployment.rewardPolicy as Address,
  rewardPool: deployment.rewardPool as Address,
  factory: deployment.brandVaultFactory as Address,
  stylusVerifier: deployment.stylusVerifier as Address,
  ecdsaVerifier: deployment.ecdsaVerifier as Address,
  usdgAdapter: deployment.usdgRewardAdapter as Address,
} as const;

export const deploymentInfo = deployment;
export const FROM_BLOCK = BigInt(deployment.fromBlock);
