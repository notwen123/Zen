import { defineChain } from "viem";

/** Robinhood Chain testnet. chainId, RPC, Multicall3 and the Blockscout explorer were verified live on 2026-09-28/29. */
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Testnet Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const FAUCET_URL = "https://faucet.testnet.chain.robinhood.com/";
export const GITHUB_URL = "https://github.com/notwen123/LINGO-DOLLAR";

export const txUrl = (hash: string) => `${robinhoodTestnet.blockExplorers.default.url}/tx/${hash}`;
export const addressUrl = (a: string) => `${robinhoodTestnet.blockExplorers.default.url}/address/${a}`;
