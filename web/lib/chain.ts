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
  submitClaim: 900_000n,
  approve: 80_000n,
  sellClaim: 450_000n,
  settle: 250_000n,
  void: 350_000n,
  deposit: 250_000n,
  withdraw: 250_000n,
} as const;
