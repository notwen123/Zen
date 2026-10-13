import "server-only";
import { createWalletClient, http, isAddress, parseEther, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { FAUCET_DRIP_MON, monadTestnet } from "@/lib/chain";
import { rateLimiter } from "@/lib/rate-limit";
import { publicClient } from "@/lib/zen";

// TESTNET ONLY: sends a small MON drip from a server-held faucet wallet so a brand-new passkey
// account can pay gas. The key never leaves the server; the route refuses any chain but 10143.
const KEY = process.env.FAUCET_PRIVATE_KEY as `0x${string}` | undefined;
const perIp = rateLimiter(3, 24 * 60 * 60_000);
const perAddress = new Map<string, number>(); // ponytail: in-memory, per instance; shared store if hosted at scale
const DRIP = parseEther(FAUCET_DRIP_MON);
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!KEY) return bad("Faucet is not configured", 503);
  if ((await publicClient.getChainId()) !== monadTestnet.id) return bad("Faucet runs on Monad testnet only", 403);
  let address: unknown;
  try {
    ({ address } = await req.json());
  } catch {
    return bad("Invalid JSON");
  }
  if (typeof address !== "string" || !isAddress(address)) return bad("A valid address is required");
  const to = address as Address;
  const last = perAddress.get(to.toLowerCase());
  if (last && Date.now() - last < 24 * 60 * 60_000) return bad("This account was already funded today.", 429);
  if ((await publicClient.getBalance({ address: to })) >= DRIP / 2n) return bad("This account already has enough MON for the demo.", 409);
  if (perIp(req)) return bad("Too many faucet requests. Try again tomorrow or use faucet.monad.xyz.", 429);

  const wallet = createWalletClient({ account: privateKeyToAccount(KEY), chain: monadTestnet, transport: http() });
  if ((await publicClient.getBalance({ address: wallet.account.address })) < DRIP * 2n)
    return bad("The demo faucet is empty. Use faucet.monad.xyz.", 503);
  perAddress.set(to.toLowerCase(), Date.now());
  const hash = await wallet.sendTransaction({ to, value: DRIP, gas: 21_000n }); // Monad bills the limit: exact for a transfer
  return Response.json({ hash, amount: FAUCET_DRIP_MON });
}
