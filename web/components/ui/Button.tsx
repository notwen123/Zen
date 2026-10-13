import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "ink" | "ghost" | "quiet";
const styles: Record<Variant, string> = {
  ink: "ink-btn bg-ink text-paper hover:text-paper",
  ghost: "ink-btn border border-ink/80 text-ink hover:text-paper",
  quiet: "text-ink ink-link",
};
const base =
  "inline-flex min-h-11 items-center justify-center gap-3 px-6 py-3 text-[0.8rem] font-semibold uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-45";

export function Button({ variant = "ink", className, ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...p} className={`${variant === "quiet" ? "" : base} ${styles[variant]} ${className ?? ""}`} />;
}

export function ButtonLink({
  href,
  variant = "ink",
  className,
  children,
  external,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const cls = `${variant === "quiet" ? "" : base} ${styles[variant]} ${className ?? ""}`;
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

export const Arrow = () => <span aria-hidden="true">→</span>;

/** Small uppercase label used for editorial eyebrows. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted ${className ?? ""}`}>{children}</p>;
}
