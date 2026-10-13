import "server-only";
import { randomUUID } from "node:crypto";
import { keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "@/lib/chain";
import { conditionalClaimAbi, contracts } from "@/lib/contracts";
import { rateLimiter } from "@/lib/rate-limit";
import { publicClient } from "@/lib/zen";

// SIMULATED MERCHANT REFUND. Plays the refund attester: it confirms the claim is still Locked and
// inside its return window, then signs an EIP-712 RefundAttestation for VoidOracle. Anyone can call
// it (demo), which is why it is labelled "simulated" everywhere. In production the attester only
// signs after checking a merchant-signed refund receipt (or a DKIM-verified refund email).

const KEY = process.env.ATTESTER_ECDSA_KEY as Hex | undefined;
const limited = rateLimiter(10, 10 * 60_000);
const bad = (error: string, status = 400) => Response.json({ error }, { status });

const TYPES = {
  RefundAttestation: [
    { name: "claimId", type: "uint256" },
    { name: "refundRef", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export async function POST(req: Request) {
  if (!KEY) return bad("Refund attester is not configured", 503);
  if (limited(req)) return bad("Too many requests. Try again in a few minutes.", 429);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON");
  }
  const raw = body.claimId;
  if ((typeof raw !== "string" && typeof raw !== "number") || !/^[1-9]\d{0,9}$/.test(String(raw))) return bad("A valid claim id is required");
  const claimId = BigInt(raw);

  try {
    const c = await publicClient.readContract({ address: contracts.conditionalClaim, abi: conditionalClaimAbi, functionName: "claimOf", args: [claimId] });
    const now = Math.floor(Date.now() / 1000);
    if (c.status !== 1) return bad("Only Locked claims can be refunded.", 409);
    if (now >= Number(c.unlockAt)) return bad("The return window has closed. This claim can only settle now.", 410);

    const refundRef = keccak256(stringToHex(`refund:${claimId}:${randomUUID()}`));
    const deadline = BigInt(now + 600);
    const signature = await privateKeyToAccount(KEY).signTypedData({
      domain: { name: "Zen VoidOracle", version: "1", chainId: monadTestnet.id, verifyingContract: contracts.voidOracle },
      types: TYPES,
      primaryType: "RefundAttestation",
      message: { claimId, refundRef, deadline },
    });
    return Response.json({ claimId: claimId.toString(), refundRef, deadline: deadline.toString(), signature, simulated: true });
  } catch (e) {
    console.error("merchant refund failed", e instanceof Error ? e.message : "unknown error");
    return bad("Couldn't sign the refund.", 500);
  }
}
