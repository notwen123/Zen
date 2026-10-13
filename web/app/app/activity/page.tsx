"use client";

import { useAccount } from "wagmi";
import { useActivity } from "@/components/hooks/useZen";
import { ActivityTimeline, Empty, Muted, ScanLink } from "@/components/ownership/Ownership";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";

export default function Activity() {
  const { address } = useAccount();
  const { data, isLoading, isError } = useActivity(address);
  return (
    <div className="mx-auto max-w-3xl">
      <Muted>Activity</Muted>
      <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Your ledger.</h1>
      <p className="mt-3 text-sm text-muted">Every conditional claim you earned and where it stands now, read from the ConditionalClaim contract on Monad testnet.</p>
      <div className="mt-12">
        {!address ? (
          <Empty title="Connect your wallet." body="Your claims are read from Monad testnet for the connected wallet." cta={<ConnectWallet />} />
        ) : isLoading ? (
          <p className="breathe text-muted" role="status">
            Reading Monad testnet…
          </p>
        ) : isError ? (
          <Empty title="Activity isn't available right now." body="The Monad testnet RPC didn't respond. Try again in a moment." />
        ) : data?.length ? (
          <ActivityTimeline items={data} />
        ) : (
          <Empty title="No activity yet." body="Your verified purchases will appear here as locked equity claims." cta={<ScanLink />} />
        )}
      </div>
    </div>
  );
}
