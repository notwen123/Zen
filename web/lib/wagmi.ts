import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { cookieStorage, createStorage, http } from "wagmi";
import { robinhoodTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "STOCKBACK",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [robinhoodTestnet],
  transports: { [robinhoodTestnet.id]: http() },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});
