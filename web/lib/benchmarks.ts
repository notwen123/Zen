import { benchmarkRows } from "./generated/benchmark";

export type BenchRow = (typeof benchmarkRows)[number];

/** Measured on-chain benchmark (generated from benchmarks/results by `npm run sync-contracts`). Null if absent. */
export async function getOnchainBenchmark(): Promise<{ rows: BenchRow[] } | null> {
  return benchmarkRows.length ? { rows: benchmarkRows } : null;
}
