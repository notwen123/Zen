import type { Address } from "viem";
import { deployment } from "./generated/deployment";

/** Presentation metadata only. Rules, rates, caps and budgets are always read from chain.
 *  These are fictional DEMO ASSETS - no affiliation with the named brands. */
export type Brand = {
  id: "NIKE" | "SBUX" | "AAPL";
  name: string;
  category: string;
  asset: string; // mock underlying symbol
  share: string; // vault share symbol
  vault: Address;
  exitPool: Address; // InstantExitPool for this equity token
  equity: Address; // mock tokenized-equity ERC-20
  merchant: string; // demo merchant label used by the demo receipt
  keywords: string[]; // OCR brand detection
  logo: string; // monochrome mask, rendered in ink via <BrandMark>
};

export const BRANDS: Brand[] = [
  { id: "NIKE", name: "Nike", category: "Fashion", asset: "mNKE", share: "zmNKE", vault: deployment.mNKEVault as Address, exitPool: deployment.mNKEExitPool as Address, equity: deployment.mNKEAsset as Address, merchant: "Nike Store 042, Mumbai", keywords: ["NIKE"], logo: "/brands/nike.png" },
  { id: "AAPL", name: "Apple", category: "Electronics", asset: "mAAPL", share: "zmAAPL", vault: deployment.mAAPLVault as Address, exitPool: deployment.mAAPLExitPool as Address, equity: deployment.mAAPLAsset as Address, merchant: "Apple Store BKC, Mumbai", keywords: ["APPLE", "IPHONE", "MACBOOK", "IPAD"], logo: "/brands/apple.png" },
  { id: "SBUX", name: "Starbucks", category: "Food & beverage", asset: "mSBUX", share: "zmSBUX", vault: deployment.mSBUXVault as Address, exitPool: deployment.mSBUXExitPool as Address, equity: deployment.mSBUXAsset as Address, merchant: "Starbucks, Bandra West", keywords: ["STARBUCKS", "SBUX"], logo: "/brands/starbucks.png" },
];

export const brandById = (id: string) => BRANDS.find((b) => b.id === id);
