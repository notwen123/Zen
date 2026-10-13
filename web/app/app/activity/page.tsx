"use client";

import { useAccount } from "wagmi";
import { useActivity } from "@/components/hooks/useStockback";
import { ActivityTimeline, Empty, Muted, ScanLink } from "@/components/ownership/Ownership";

export default function Activity() {
  const { address } = useAccount();
  const { data, isLoading, isError } = useActivity(address);
  return (
    <div className="mx-auto max-w-3xl">
      <Muted>Activity</Muted>
      <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Your ledger.</h1>
      <p className="mt-3 text-sm text-muted">Every claimed purchase, read from the registry&apos;s events on Robinhood testnet.</p>
      <div className="mt-12">
        {isLoading ? (
          <p className="breathe text-muted">Reading Robinhood testnet…</p>
        ) : isError ? (
          <Empty title="Activity isn't available right now." body="The testnet RPC didn't respond. Try again in a moment." />
        ) : data?.length ? (
          <ActivityTimeline items={data} />
        ) : (
          <Empty title="No activity yet." body="Your claimed purchases will appear here." cta={<ScanLink />} />
        )}
      </div>
    </div>
  );
}
