"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getActiveVerifier, getActivity, getAllClaims, getClaimsOf, getPoolClaims, getPools, getSupportedBrands, getUserPortfolio } from "@/lib/zen";

export const useBrands = () => useQuery({ queryKey: ["brands"], queryFn: getSupportedBrands, staleTime: 60_000 });

export const usePortfolio = (user?: Address) =>
  useQuery({ queryKey: ["portfolio", user], queryFn: () => getUserPortfolio(user!), enabled: !!user });

export const useActivity = (user?: Address) =>
  useQuery({ queryKey: ["activity", user], queryFn: () => getActivity(user!), enabled: !!user });

export const useVerifier = () => useQuery({ queryKey: ["verifier"], queryFn: getActiveVerifier, staleTime: 60_000 });

/** Every settled claim on the registry (all wallets), refreshed every 30 s for the live ticker. */
export const useRecentClaims = () =>
  useQuery({ queryKey: ["activity", "all"], queryFn: () => getActivity(), refetchInterval: 30_000 });

/** Conditional claims the user earned or holds; refetched often so countdowns and quotes stay live. */
export const useClaims = (user?: Address) =>
  useQuery({ queryKey: ["claims", user], queryFn: () => getClaimsOf(user!), enabled: !!user, refetchInterval: 15_000 });

export const useAllClaims = () => useQuery({ queryKey: ["claims", "all"], queryFn: getAllClaims, refetchInterval: 30_000 });

export const usePools = (user?: Address) =>
  useQuery({ queryKey: ["pools", user], queryFn: () => getPools(user), refetchInterval: 15_000 });

export const usePoolClaims = (pool?: Address) =>
  useQuery({ queryKey: ["poolClaims", pool], queryFn: () => getPoolClaims(pool!), enabled: !!pool, refetchInterval: 20_000 });
