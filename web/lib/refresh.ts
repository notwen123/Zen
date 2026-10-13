import type { QueryClient } from "@tanstack/react-query";

/** After a confirmed tx: refetch now and again shortly after. A load-balanced public RPC can answer
 *  the first read from a node one block behind the one that returned the receipt. */
export function refreshAfterTx(qc: QueryClient, keys = ["claims", "activity", "pools", "poolClaims", "portfolio", "mon"]) {
  const run = () => keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k], refetchType: "all" }));
  run();
  for (const ms of [1500, 4000, 8000, 15000]) setTimeout(run, ms);
}
