import type { Address } from "viem";
import { deployment } from "./generated/deployment";
export * from "./generated/abis";

/** Live Monad testnet addresses, generated from deployments/10143.json (npm run sync-contracts). */
export const contracts = {
  registry: deployment.registry as Address,
  eligibilityPolicy: deployment.eligibilityPolicy as Address,
  rewardPolicy: deployment.rewardPolicy as Address,
  rewardPool: deployment.rewardPool as Address,
  factory: deployment.brandVaultFactory as Address,
  ecdsaVerifier: deployment.verifier as Address,
  conditionalClaim: deployment.conditionalClaim as Address,
  voidOracle: deployment.voidOracle as Address,
  ausdAdapter: deployment.ausdRewardAdapter as Address,
} as const;

export const deploymentInfo = deployment;
export const FROM_BLOCK = BigInt(deployment.fromBlock);
