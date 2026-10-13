import type { Metadata } from "next";
import { BrandGallery } from "@/components/brand/BrandGallery";
import { Eyebrow } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Brands" };

export default function AppBrands() {
  return (
    <div className="mx-auto max-w-6xl">
      <Eyebrow>Brands</Eyebrow>
      <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Where your receipts count.</h1>
      <div className="mt-12">
        <BrandGallery compact />
      </div>
    </div>
  );
}
