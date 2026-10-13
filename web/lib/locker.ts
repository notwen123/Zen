"use client";

/**
 * Receipt Locker: raw receipt payloads (merchant QR payloads) and claim proofs, encrypted on this
 * device with AES-256-GCM under a key derived from the user's passkey PRF output
 * (HKDF, info "zen-receipt-locker-v1"; see lib/account.tsx). Only the same passkey can reopen them,
 * on any device: export the encrypted backup, import it elsewhere, sign in with the same passkey.
 * Stored in IndexedDB; plaintext never touches storage or a server.
 */
import { stringify, parse } from "./locker-json";

export type LockerKind = "receipt" | "claim-proof";
export type LockerEntry = { id: string; kind: LockerKind; createdAt: number; iv: string; ct: string };
export type LockerPlain = { title: string; data: unknown };

const DB = "zen-receipt-locker";
const STORE = "entries";
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** The entry id and kind are bound into the ciphertext as AES-GCM additional data. */
const aad = (id: string, kind: LockerKind) => new TextEncoder().encode(`zen-locker/v1/${kind}/${id}`);

export async function seal(key: CryptoKey, kind: LockerKind, plain: LockerPlain): Promise<LockerEntry> {
  const id = crypto.randomUUID();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(id, kind) }, key, new TextEncoder().encode(stringify(plain))),
  );
  const entry = { id, kind, createdAt: Date.now(), iv: b64(iv), ct: b64(ct) };
  await tx("readwrite", (s) => s.put(entry));
  return entry;
}

export async function open(key: CryptoKey, e: LockerEntry): Promise<LockerPlain> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv), additionalData: aad(e.id, e.kind) }, key, unb64(e.ct));
  return parse(new TextDecoder().decode(pt)) as LockerPlain;
}

export const listEntries = async () => ((await tx("readonly", (s) => s.getAll())) as LockerEntry[]).sort((a, b) => b.createdAt - a.createdAt);
export const removeEntry = (id: string) => tx("readwrite", (s) => s.delete(id));
export async function importEntries(entries: LockerEntry[]) {
  for (const e of entries) if (e?.id && e.iv && e.ct && (e.kind === "receipt" || e.kind === "claim-proof")) await tx("readwrite", (s) => s.put(e));
}

/** Best-effort save from flows (claims never fail because the locker did). */
export async function trySeal(key: CryptoKey | undefined, kind: LockerKind, plain: LockerPlain) {
  if (!key) return;
  try {
    await seal(key, kind, plain);
  } catch {}
}
