"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useAccount } from "@/lib/account";
import { useActivity } from "@/components/hooks/useZen";
import { ActivityTimeline, Empty, ScanLink } from "@/components/ownership/Ownership";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { MarketTape } from "@/components/indexer/MarketTape";

export default function Activity() {
  const { address } = useAccount();
  const { data, isLoading, isError } = useActivity(address);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Activity">Every claim you earned and every transaction behind it, read from Monad testnet.</PageHeader>
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
          <>
            <ActivityTimeline items={data} />
            <div className="mt-12">
              <MarketTape account={address} title="Your transactions" limit={50} />
            </div>
          </>
        ) : (
          <Empty title="No activity yet." body="Your verified purchases will appear here as locked equity claims." cta={<ScanLink />} />
        )}
      </div>
    </div>
  );
}
