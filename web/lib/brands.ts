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
  merchant: string; // demo merchant label used by the demo receipt
  keywords: string[]; // OCR brand detection
  logo: string; // monochrome mask, rendered in ink via <BrandMark>
};

export const BRANDS: Brand[] = [
  { id: "NIKE", name: "Nike", category: "Footwear & apparel", asset: "mNKE", share: "sbNKE", vault: deployment.mNKEVault as Address, merchant: "Nike Store 042, Mumbai", keywords: ["NIKE"], logo: "/brands/nike.png" },
  { id: "AAPL", name: "Apple", category: "Electronics", asset: "mAAPL", share: "sbAAPL", vault: deployment.mAAPLVault as Address, merchant: "Apple Store BKC, Mumbai", keywords: ["APPLE", "IPHONE", "MACBOOK", "IPAD"], logo: "/brands/apple.png" },
  { id: "SBUX", name: "Starbucks", category: "Coffee", asset: "mSBUX", share: "sbSBUX", vault: deployment.mSBUXVault as Address, merchant: "Starbucks, Bandra West", keywords: ["STARBUCKS", "SBUX"], logo: "/brands/starbucks.png" },
];

export const brandById = (id: string) => BRANDS.find((b) => b.id === id);
