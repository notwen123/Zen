import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { monadTestnet } from "./chain";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const common = {
  chains: [monadTestnet] as const,
  transports: { [monadTestnet.id]: http() },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
};

/** With a WalletConnect project id: the full RainbowKit wallet list. Without one: browser-injected
 *  wallets only (MetaMask, Rabby, Phantom, ...), so the app still builds and runs. */
export const wagmiConfig = projectId
  ? getDefaultConfig({ appName: "Zen", projectId, ...common })
  : createConfig({
      ...common,
      connectors: connectorsForWallets([{ groupName: "Browser wallet", wallets: [injectedWallet] }], {
        appName: "Zen",
        projectId: "unused",
      }),
    });
