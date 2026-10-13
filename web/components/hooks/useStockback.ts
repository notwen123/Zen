"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getActiveVerifier, getActivity, getSupportedBrands, getUserPortfolio } from "@/lib/stockback";

export const useBrands = () => useQuery({ queryKey: ["brands"], queryFn: getSupportedBrands, staleTime: 60_000 });

export const usePortfolio = (user?: Address) =>
  useQuery({ queryKey: ["portfolio", user], queryFn: () => getUserPortfolio(user!), enabled: !!user });

export const useActivity = (user?: Address) =>
  useQuery({ queryKey: ["activity", user], queryFn: () => getActivity(user!), enabled: !!user });

export const useVerifier = () => useQuery({ queryKey: ["verifier"], queryFn: getActiveVerifier, staleTime: 60_000 });

/** Every settled claim on the registry (all wallets), refreshed every 30 s for the live ticker. */
export const useRecentClaims = () =>
  useQuery({ queryKey: ["activity", "all"], queryFn: () => getActivity(), refetchInterval: 30_000 });
