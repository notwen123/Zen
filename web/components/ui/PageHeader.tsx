import type { ReactNode } from "react";

/** One header pattern for every app page: a title, one sentence, and at most one primary action. */
export function PageHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b border-ink/10 pb-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h1>
        {children && <p className="mt-3 text-[0.95rem] leading-relaxed text-charcoal">{children}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
