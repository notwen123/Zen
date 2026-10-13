import type { Brand } from "@/lib/brands";

/** Brand logo rendered as a CSS mask in the current text colour, so every mark stays on-palette (ink by default). */
export function BrandMark({ brand, className }: { brand: Pick<Brand, "name" | "logo">; className?: string }) {
  const mask = `url(${brand.logo}) center / contain no-repeat`;
  return (
    <span
      role="img"
      aria-label={`${brand.name} logo`}
      className={`inline-block shrink-0 bg-current ${className ?? "h-6 w-6"}`}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
