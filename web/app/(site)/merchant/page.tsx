import type { Metadata } from "next";
import { MerchantPos } from "@/components/merchant/MerchantPos";

export const metadata: Metadata = {
  title: "Merchant desk (simulated)",
  description: "A simulated merchant for the Zen demo: issue merchant-signed receipts, and issue refunds that void locked claims on Monad testnet.",
};

export default function MerchantPage() {
  return <MerchantPos />;
}
