import type { Metadata } from "next";
import { ScanFlow } from "@/components/receipt/ScanFlow";

export const metadata: Metadata = { title: "Scan receipt" };

export default function ScanPage() {
  return <ScanFlow />;
}
