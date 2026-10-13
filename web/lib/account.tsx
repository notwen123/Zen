"use client";

/**
 * Zen's ENTIRE account layer: a Monad EOA derived from a passkey with Mera (@category-labs/mera).
 * No seed phrase, no extension, no custody backend.
 *
 *   passkey PRF output (32 bytes, never stored)
 *     ├─ BIP-39/44  m/44'/60'/0'/0/0  ──> secp256k1 signing session ──> viem account (all writes)
 *     └─ HKDF-SHA256(info = "zen-receipt-locker-v1") ──> non-extractable AES-GCM key (Receipt Locker)
 *
 * The two keys come from domain-separated derivations; the signing key is never used for encryption
 * and the locker key can't sign. Hooks below keep the names the app already used (useAccount,
 * useWriteContract, ...) so every page migrated without changing its logic.
 */
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
  type Secp256k1SigningSession,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createWalletClient, http, type Abi, type Address, type Hex, type LocalAccount } from "viem";
import { monadTestnet } from "./chain";
import { publicClient } from "./zen";

const CREDENTIAL_KEY = "zen.passkey";
const IDLE_MS = 30 * 60_000;
export const LOCKER_INFO = "zen-receipt-locker-v1";

/** The faucet funds an address once a day; remember it so the UI doesn't offer a drip that would be refused. */
const FUNDED = (a: string) => `zen.funded.${a.toLowerCase()}`;
export function markFunded(a: string) {
  try {
    localStorage.setItem(FUNDED(a), String(Date.now()));
  } catch {}
}
export function fundedRecently(a: string) {
  try {
    return Date.now() - Number(localStorage.getItem(FUNDED(a)) ?? 0) < 24 * 60 * 60_000;
  } catch {
    return false;
  }
}

type Status = "disconnected" | "connecting" | "connected";
type Ctx = {
  status: Status;
  address?: Address;
  account?: LocalAccount;
  lockerKey?: CryptoKey;
  error?: string;
  signUp: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => void;
  hasCredential: boolean;
};
const AccountContext = createContext<Ctx | null>(null);

function deriveEvmKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("derivation produced no key");
  return node.privateKey;
}

/** Separate key for the Receipt Locker: HKDF over the PRF output with its own info string. */
async function deriveLockerKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", prfOutput as BufferSource, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("zen/passkey-prf/v1"), info: new TextEncoder().encode(LOCKER_INFO) },
    ikm,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable: the locker key never leaves WebCrypto
    ["encrypt", "decrypt"],
  );
}

/** MeraError codes -> product copy. */
export function accountErrorMessage(e: unknown): string {
  if (isMeraError(e)) {
    switch (e.code) {
      case "PRF_UNAVAILABLE":
        return "This passkey provider doesn't support the PRF extension Zen needs. Use Google Password Manager (Chrome; on desktop make sure the passkey is saved to Google Password Manager, not this Chrome profile), iCloud Keychain (Safari / Apple devices) or 1Password.";
      case "PASSKEY_OPERATION_FAILED":
        return "The passkey prompt was dismissed or failed. Try again.";
      case "CRYPTO_UNAVAILABLE":
        return "Passkeys need a secure context: open Zen over HTTPS (or localhost).";
      case "SESSION_ENDED":
        return "Your session ended. Sign in with your passkey again.";
      default:
        return `Passkey error (${e.code}).`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

const subscribeCred = () => () => {};
const readCred = () => {
  try {
    return !!localStorage.getItem(CREDENTIAL_KEY);
  } catch {
    return false;
  }
};

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [account, setAccount] = useState<LocalAccount>();
  const [lockerKey, setLockerKey] = useState<CryptoKey>();
  const [error, setError] = useState<string>();
  const stored = useSyncExternalStore(subscribeCred, readCred, () => false);
  const [created, setHasCredential] = useState(false);
  const hasCredential = stored || created;
  const session = useRef<Secp256k1SigningSession | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(() => {
    session.current?.end(); // zeroes the signing key
    session.current = null;
    setAccount(undefined);
    setLockerKey(undefined);
    setStatus("disconnected");
  }, []);

  const touch = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(signOut, IDLE_MS);
  }, [signOut]);

  const open = useCallback(
    async (prfOutput: Uint8Array) => {
      const key = deriveEvmKey(prfOutput);
      session.current?.end();
      session.current = createSecp256k1SigningSession({ privateKey: key });
      key.fill(0);
      setLockerKey(await deriveLockerKey(prfOutput));
      prfOutput.fill(0);
      setAccount(toViemAccount(session.current));
      setStatus("connected");
      touch();
    },
    [touch],
  );

  const run = useCallback(
    async (fn: () => Promise<Uint8Array>) => {
      setError(undefined);
      setStatus("connecting");
      try {
        await open(await fn());
      } catch (e) {
        setError(accountErrorMessage(e));
        setStatus("disconnected");
      }
    },
    [open],
  );

  const fresh = useRef(false);
  // A brand-new account starts with 0 MON: ask the testnet faucet once, so every button works right away.
  useEffect(() => {
    if (!account || !fresh.current) return;
    fresh.current = false;
    void fetch("/api/faucet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: account.address }) })
      .then((r) => r.ok && markFunded(account.address))
      .catch(() => {});
  }, [account]);

  const signUp = useCallback(
    () =>
      run(async () => {
        fresh.current = true;
        const created = await createPasskeyWithPrfOutput({
          rp: { id: location.hostname, name: "Zen" },
          user: { name: `zen-${new Date().toISOString().slice(0, 10)}`, displayName: "Zen account" },
        });
        localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ credentialId: created.credentialId, transports: created.transports }));
        setHasCredential(true);
        return created.prfOutput;
      }),
    [run],
  );

  const signIn = useCallback(
    () =>
      run(async () => {
        const stored = localStorage.getItem(CREDENTIAL_KEY);
        const known = stored ? JSON.parse(stored) : undefined;
        const { prfOutput, credentialId } = await getPasskeyPrfOutput({ rpId: location.hostname, credential: known });
        localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(known?.credentialId === credentialId ? known : { credentialId }));
        setHasCredential(true);
        return prfOutput;
      }),
    [run],
  );

  useEffect(() => () => session.current?.end(), []);

  const value = useMemo<Ctx>(
    () => ({ status, address: account?.address, account, lockerKey, error, signUp, signIn, signOut, hasCredential }),
    [status, account, lockerKey, error, signUp, signIn, signOut, hasCredential],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function usePasskeyAccount() {
  const c = useContext(AccountContext);
  if (!c) throw new Error("usePasskeyAccount outside AccountProvider");
  return c;
}

// ---------------------------------------------------------------- compatibility hooks (former wagmi API)

export function useAccount() {
  const c = usePasskeyAccount();
  return {
    address: c.address,
    status: c.status,
    isConnected: c.status === "connected",
    chainId: c.status === "connected" ? monadTestnet.id : undefined,
    connector: c.status === "connected" ? { name: "Passkey (Mera)" } : undefined,
  };
}

export type WriteRequest = {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  gas: bigint; // Monad bills the gas LIMIT: every write carries an explicit, tight limit
  chainId?: number;
};

/** Every write signs with the passkey-derived viem account on Monad testnet. */
export function useWriteContract() {
  const { account } = usePasskeyAccount();
  const [isPending, setPending] = useState(false);
  const writeContractAsync = useCallback(
    async (req: WriteRequest): Promise<Hex> => {
      if (!account) throw new Error("Sign in with your passkey first.");
      const wallet = createWalletClient({ account, chain: monadTestnet, transport: http() });
      setPending(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await wallet.writeContract({ ...(req as any), chain: monadTestnet, account, gas: req.gas });
      } finally {
        setPending(false);
      }
    },
    [account],
  );
  return { writeContractAsync, isPending };
}

export function useWaitForTransactionReceipt({ hash }: { hash?: Hex }) {
  return useQuery({
    queryKey: ["receipt", hash],
    queryFn: () => publicClient.waitForTransactionReceipt({ hash: hash! }),
    enabled: !!hash,
    staleTime: Infinity,
  });
}

/** One chain only (Monad testnet), so there is nothing to switch. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useSwitchChain = () => ({ switchChainAsync: async (_: { chainId: number }) => undefined, switchChain: (_: { chainId: number }) => undefined, isPending: false });
export const useConnectModal = () => {
  const { signIn, signUp, hasCredential } = usePasskeyAccount();
  return { openConnectModal: () => void (hasCredential ? signIn() : signUp()) };
};
export const useDisconnect = () => ({ disconnect: usePasskeyAccount().signOut });
export function useAccountEffect({ onConnect }: { onConnect?: (d: { address: Address }) => void }) {
  const { address } = usePasskeyAccount();
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (address && seen.current !== address) onConnect?.({ address });
    seen.current = address;
  }, [address, onConnect]);
}
