/**
 * Envio HyperIndex (indexer/): every claim, cash-out, refund, settlement and LP flow with its tx hash,
 * served over GraphQL. The app uses it for history and the market tape, and falls back to reading
 * contract state directly when the indexer isn't reachable (Monad's public RPC caps eth_getLogs at 100 blocks).
 */
import type { Address } from "viem";

export const ENVIO_URL = process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "http://localhost:8080/v1/graphql";

export type IndexedEvent = {
  id: string;
  kind: "CLAIM" | "CASH_OUT" | "REFUND" | "SETTLE" | "LP_DEPOSIT" | "LP_WITHDRAW";
  account: string;
  claimId: string | null;
  brand: string | null;
  amount: bigint;
  price: bigint | null;
  pool: string | null;
  timestamp: number;
  txHash: `0x${string}`;
};

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 5000);
  try {
    const r = await fetch(ENVIO_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: ctl.signal,
    });
    const j = await r.json();
    if (!r.ok || j.errors) throw new Error(j.errors?.[0]?.message ?? `Envio indexer HTTP ${r.status}`);
    return j.data as T;
  } finally {
    clearTimeout(t);
  }
}

type Raw = Omit<IndexedEvent, "amount" | "price" | "timestamp"> & { amount: string; price: string | null; timestamp: string };
const FIELDS = "id kind account claimId brand amount price pool timestamp txHash";
const toEvent = (r: Raw): IndexedEvent => ({
  ...r,
  amount: BigInt(r.amount),
  price: r.price == null ? null : BigInt(r.price),
  timestamp: Number(r.timestamp),
});

/** Latest events (optionally for one wallet or one pool), newest first. */
export async function getIndexedEvents(opts: { account?: Address; pool?: Address; limit?: number } = {}): Promise<IndexedEvent[]> {
  const where: Record<string, unknown> = {};
  if (opts.account) where.account = { _eq: opts.account.toLowerCase() };
  if (opts.pool) where.pool = { _eq: opts.pool.toLowerCase() };
  const d = await gql<{ Activity: Raw[] }>(
    `query Q($where: Activity_bool_exp!, $limit: Int!) { Activity(where: $where, order_by: { timestamp: desc }, limit: $limit) { ${FIELDS} } }`,
    { where, limit: opts.limit ?? 50 },
  );
  return d.Activity.map(toEvent);
}

export const EVENT_LABEL: Record<IndexedEvent["kind"], string> = {
  CLAIM: "Purchase → locked claim",
  CASH_OUT: "Cash out to LP pool",
  REFUND: "Refund → claim voided",
  SETTLE: "Settled to holder",
  LP_DEPOSIT: "LP deposit",
  LP_WITHDRAW: "LP withdraw",
};
