"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePasskeyAccount } from "@/lib/account";
import { shortAddress } from "@/lib/zen";

const noop = () => () => {};

/** Passkey sign-in (Mera): create a passkey once, reuse it everywhere. No seed phrase, no extension. */
export function ConnectWallet({ label = "Sign in with passkey", className }: { label?: string; className?: string }) {
  const { status, address, hasCredential, signIn, signUp, error } = usePasskeyAccount();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const cls = `ink-btn inline-flex min-h-10 items-center gap-2.5 px-4 py-2 text-[0.75rem] font-semibold uppercase tracking-[0.16em] ${className ?? ""}`;
  if (!mounted) return <span className={`${cls} invisible`} aria-hidden="true">{label}</span>;
  if (status === "connected" && address)
    return (
      <Link href="/app/dashboard" className={`${cls} border border-ink/70 text-ink hover:text-paper`} aria-label={`Open Zen app, signed in as ${address}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />
        <span className="font-mono normal-case tracking-normal">{shortAddress(address)}</span>
      </Link>
    );
  return (
    <span className="inline-flex flex-col items-start gap-2">
      <span className="inline-flex flex-wrap gap-2">
        <button type="button" disabled={status === "connecting"} onClick={() => void (hasCredential ? signIn() : signUp())} className={`${cls} bg-ink text-paper`}>
          {status === "connecting" ? "Waiting for passkey…" : hasCredential ? label : "Create passkey account"}
        </button>
        {status !== "connecting" && (
          <button type="button" onClick={() => void (hasCredential ? signUp() : signIn())} className={`${cls} border border-ink/40 text-ink`}>
            {hasCredential ? "New passkey" : "I have a passkey"}
          </button>
        )}
      </span>
      {error && (
        <span role="alert" className="max-w-md text-xs normal-case tracking-normal text-vermilion-deep">
          {error}
        </span>
      )}
    </span>
  );
}
