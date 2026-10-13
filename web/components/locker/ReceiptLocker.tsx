"use client";

import { useCallback, useEffect, useState } from "react";
import { LOCKER_INFO, usePasskeyAccount } from "@/lib/account";
import { importEntries, listEntries, open, removeEntry, type LockerEntry, type LockerPlain } from "@/lib/locker";
import { stringify } from "@/lib/locker-json";

export function ReceiptLocker() {
  const { lockerKey } = usePasskeyAccount();
  const [entries, setEntries] = useState<LockerEntry[]>([]);
  const [opened, setOpened] = useState<Record<string, LockerPlain | "error">>({});
  const [note, setNote] = useState<string>();
  const refresh = useCallback(() => listEntries().then(setEntries).catch(() => setEntries([])), []);
  useEffect(() => void refresh(), [refresh]);

  async function reveal(e: LockerEntry) {
    if (!lockerKey) return;
    try {
      const p = await open(lockerKey, e);
      setOpened((o) => ({ ...o, [e.id]: p }));
    } catch {
      setOpened((o) => ({ ...o, [e.id]: "error" }));
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ format: "zen-receipt-locker/v1", entries }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `zen-receipt-locker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(f: File) {
    try {
      const j = JSON.parse(await f.text());
      if (j.format !== "zen-receipt-locker/v1" || !Array.isArray(j.entries)) throw new Error("Not a Zen locker backup");
      await importEntries(j.entries);
      setNote(`Imported ${j.entries.length} encrypted entries. They open only with the passkey that sealed them.`);
      refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Receipt Locker · encrypted on this device</p>
      <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">Only your passkey opens it.</h1>
      <p className="mt-4 max-w-2xl text-charcoal">
        Every merchant receipt you scan and every claim proof you mint is sealed here with AES-256-GCM. The key is derived from your
        passkey&apos;s PRF output with HKDF (<span className="font-mono text-sm">{LOCKER_INFO}</span>), separately from the key that signs your
        transactions, and it never leaves the browser&apos;s crypto engine. Keep these to back a refund dispute, or export the encrypted backup and
        re-open it on a new device by signing in with the same passkey.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={exportBackup} disabled={!entries.length} className="border border-ink px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-40">
          Export encrypted backup
        </button>
        <label className="cursor-pointer border border-ink/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]">
          Import backup
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
        </label>
      </div>
      {note && <p aria-live="polite" className="mt-3 text-sm text-charcoal">{note}</p>}

      <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/15">
        {entries.length === 0 && <li className="py-6 text-sm text-muted">Empty. Scan a merchant receipt and claim it: the receipt and the claim proof land here, encrypted.</li>}
        {entries.map((e) => {
          const o = opened[e.id];
          return (
            <li key={e.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    {e.kind === "receipt" ? "Signed receipt" : "Claim proof"} · {new Date(e.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 font-medium">{o && o !== "error" ? o.title : "Sealed · " + e.ct.length + " bytes of ciphertext"}</p>
                </div>
                <div className="flex gap-2">
                  {!o && (
                    <button type="button" onClick={() => reveal(e)} disabled={!lockerKey} className="bg-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-paper disabled:opacity-40">
                      Open with passkey key
                    </button>
                  )}
                  <button type="button" onClick={() => removeEntry(e.id).then(refresh)} className="border border-ink/30 px-3 py-1.5 text-xs uppercase tracking-[0.12em]">
                    Delete
                  </button>
                </div>
              </div>
              {o === "error" && <p className="mt-2 text-sm text-vermilion-deep">Can&apos;t decrypt: this entry was sealed by a different passkey.</p>}
              {o && o !== "error" && <pre className="mt-3 max-h-72 overflow-auto bg-paper-dark/50 p-3 text-xs">{JSON.stringify(JSON.parse(stringify(o.data)), null, 2)}</pre>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
