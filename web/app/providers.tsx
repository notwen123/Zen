"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { AccountProvider } from "@/lib/account";

type MotionPref = "system" | "reduced";
const MotionPrefContext = createContext<{ pref: MotionPref; setPref: (p: MotionPref) => void }>({
  pref: "system",
  setPref: () => {},
});
export const useMotionPref = () => useContext(MotionPrefContext);

// Motion preference lives in localStorage; read it as an external store (server snapshot: "system").
const prefListeners = new Set<() => void>();
const subscribePref = (cb: () => void) => (prefListeners.add(cb), () => void prefListeners.delete(cb));
const readPref = (): MotionPref => {
  try {
    return localStorage.getItem("sb-motion") === "reduced" ? "reduced" : "system";
  } catch {
    return "system";
  }
};
const setPref = (p: MotionPref) => {
  try {
    localStorage.setItem("sb-motion", p);
  } catch {}
  prefListeners.forEach((l) => l());
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  const pref = useSyncExternalStore(subscribePref, readPref, () => "system" as const);

  useEffect(() => {
    document.documentElement.classList.toggle("motion-off", pref === "reduced");
  }, [pref]);

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <MotionPrefContext.Provider value={{ pref, setPref }}>
          <MotionConfig reducedMotion={pref === "reduced" ? "always" : "user"}>{children}</MotionConfig>
        </MotionPrefContext.Provider>
      </AccountProvider>
    </QueryClientProvider>
  );
}
