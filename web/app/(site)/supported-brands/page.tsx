import type { Metadata } from "next";
import { BrandGallery } from "@/components/brand/BrandGallery";
import { RevealLines } from "@/components/motion/Motion";
import { Eyebrow } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Supported brands" };

export default function SupportedBrands() {
  return (
    <div className="mx-auto max-w-[1320px] px-5 py-24 sm:px-8">
      <Eyebrow>Gallery · Robinhood testnet</Eyebrow>
      <h1 className="mt-6 font-display text-[clamp(2.8rem,7vw,5.6rem)] font-extrabold leading-[0.98]">
        <RevealLines lines={["Supported brands."]} />
      </h1>
      <p className="mt-6 max-w-xl text-lg text-charcoal">Three demo vaults, each with its own rules, reward rate and budget, all read live from chain.</p>
      <div className="mt-16">
        <BrandGallery />
      </div>
    </div>
  );
}
