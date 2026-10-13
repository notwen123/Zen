import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Shippori_Mincho } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "./providers";

const mincho = Shippori_Mincho({ weight: ["500", "700", "800"], subsets: ["latin"], variable: "--font-mincho", display: "swap", preload: false });
const ui = Instrument_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const numeric = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-numeric", display: "swap" });

export const metadata: Metadata = {
  title: { default: "STOCKBACK — Scan. Prove. Own.", template: "%s · STOCKBACK" },
  description:
    "STOCKBACK turns attested purchase receipts into on-chain ownership rewards through brand vaults on Robinhood Chain testnet. Demo assets only.",
};

export const viewport: Viewport = { themeColor: "#F4EFE3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mincho.variable} ${ui.variable} ${numeric.variable}`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
