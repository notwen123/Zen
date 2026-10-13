import type { Metadata } from "next";
import { MerchantPos } from "@/components/merchant/MerchantPos";

export const metadata: Metadata = {
  title: "Merchant POS (simulated)",
  description: "A simulated point-of-sale that issues merchant-signed receipt QR codes for the STOCKBACK demo.",
};

export default function MerchantPage() {
  return <MerchantPos />;
}
