import { Hero } from "@/components/landing/Hero";
import { Journey } from "@/components/landing/Journey";
import { KineticType } from "@/components/landing/KineticType";
import { LiveProof } from "@/components/landing/LiveProof";
import { Evidence, FinalCta, Ownership, Security, LifecycleSection } from "@/components/landing/Sections";

export default function Landing() {
  return (
    <>
      <Hero />
      <LiveProof />
      <Journey />
      <KineticType />
      <LifecycleSection />
      <Ownership />
      <Evidence />
      <Security />
      <FinalCta />
    </>
  );
}
