import { defineChain } from "viem";

/** Monad testnet. Chain id, public RPC and explorer from docs.monad.xyz (developer-essentials/testnet). */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const FAUCET_URL = "https://faucet.monad.xyz";
export const GITHUB_URL = "https://github.com/notwen123/Zen";

export const txUrl = (hash: string) => `${monadTestnet.blockExplorers.default.url}/tx/${hash}`;
export const addressUrl = (a: string) => `${monadTestnet.blockExplorers.default.url}/address/${a}`;

/** Monad charges the gas LIMIT, not gas used: every write sets an explicit, tight limit. */
export const GAS = {
  // measured on Monad testnet (deployments/10143-activity.json) + ~10-20% headroom
  submitClaim: 620_000n,
  approve: 80_000n,
  sellClaim: 300_000n,
  settle: 170_000n,
  void: 320_000n,
  deposit: 200_000n,
  withdraw: 200_000n,
} as const;

/** Testnet faucet drip for new passkey accounts (server-side wallet, /api/faucet). */
export const FAUCET_DRIP_MON = "0.12";
