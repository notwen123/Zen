"use client";

import { RainbowKitProvider, lightTheme, type Theme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const base = lightTheme({ accentColor: "#171717", accentColorForeground: "#F4EFE3", borderRadius: "small", overlayBlur: "small" });
const theme: Theme = {
  ...base,
  colors: {
    ...base.colors,
    modalBackground: "#F4EFE3",
    modalBorder: "#B8B0A2",
    modalText: "#171717",
    modalTextSecondary: "#6B645B",
    actionButtonSecondaryBackground: "#E9E0D1",
    closeButtonBackground: "#E9E0D1",
    generalBorder: "#D9CFBE",
    menuItemBackground: "#E9E0D1",
    connectButtonBackground: "#F4EFE3",
    profileForeground: "#F4EFE3",
    selectedOptionBorder: "#C83A2F",
    error: "#8F211D",
  },
  fonts: { body: "var(--font-ui), system-ui, sans-serif" },
  shadows: { ...base.shadows, dialog: "0 30px 80px -30px rgba(23,23,23,.35)" },
};

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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "STOCKBACK" }}>
          <MotionPrefContext.Provider value={{ pref, setPref }}>
            <MotionConfig reducedMotion={pref === "reduced" ? "always" : "user"}>{children}</MotionConfig>
          </MotionPrefContext.Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
