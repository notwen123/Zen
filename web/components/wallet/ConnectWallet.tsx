"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePasskeyAccount } from "@/lib/account";
import { shortAddress } from "@/lib/zen";

const noop = () => () => {};

/**
 * One obvious action. A device that has used Zen before gets "Unlock with passkey"; a new visitor gets
 * "Create your account". The other path is a quiet link, not a second button of equal weight.
 */
export function ConnectWallet({ className }: { label?: string; className?: string }) {
  const { status, address, hasCredential, signIn, signUp, error } = usePasskeyAccount();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const cls = `ink-btn inline-flex min-h-11 items-center gap-2.5 px-5 py-2.5 text-sm font-semibold ${className ?? ""}`;
  if (!mounted) return <span className={`${cls} invisible`} aria-hidden="true">Sign in</span>;
  if (status === "connected" && address)
    return (
      <Link href="/app/dashboard" className={`${cls} border border-ink/70 text-ink hover:text-paper`} aria-label={`Open Zen app, signed in as ${address}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-vermilion" aria-hidden="true" />
        <span className="font-mono">{shortAddress(address)}</span>
      </Link>
    );
  const busy = status === "connecting";
  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button type="button" disabled={busy} onClick={() => void (hasCredential ? signIn() : signUp())} className={`${cls} bg-ink text-paper disabled:opacity-60`}>
        {busy ? "Waiting for your passkey…" : hasCredential ? "Unlock with passkey" : "Create your account"}
      </button>
      {!busy && (
        <button type="button" onClick={() => void (hasCredential ? signUp() : signIn())} className="text-xs text-muted underline decoration-ink/30 underline-offset-4 hover:text-ink">
          {hasCredential ? "Use a new passkey instead" : "I already have a Zen passkey"}
        </button>
      )}
      {error && (
        <span role="alert" className="max-w-sm text-xs text-vermilion-deep">
          {error}
        </span>
      )}
    </span>
  );
}
