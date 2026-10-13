"use client";

import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader title="Receipt locker">
        Your receipts and claim proofs, encrypted on this device. Only your passkey can open them, here or on a new device after you import a backup.
      </PageHeader>
      <details className="mt-4 text-sm text-muted">
        <summary className="cursor-pointer hover:text-ink">How the encryption works</summary>
        <p className="mt-2 max-w-2xl leading-relaxed">
          Each entry is sealed with AES-256-GCM. The key comes from your passkey&apos;s PRF output through HKDF (<span className="font-mono text-xs">{LOCKER_INFO}</span>),
          separately from the key that signs your transactions, and it never leaves the browser&apos;s crypto engine. Keep these to back a refund dispute or to
          re-prove a purchase.
        </p>
      </details>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={exportBackup} disabled={!entries.length} className="border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-40">
          Export encrypted backup
        </button>
        <label className="cursor-pointer border border-ink/40 px-4 py-2 text-sm font-semibold">
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
                  <p className="text-sm text-muted">
                    {e.kind === "receipt" ? "Signed receipt" : "Claim proof"} · {new Date(e.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 font-medium">{o && o !== "error" ? o.title : "Sealed · " + e.ct.length + " bytes of ciphertext"}</p>
                </div>
                <div className="flex gap-2">
                  {!o && (
                    <button type="button" onClick={() => reveal(e)} disabled={!lockerKey} className="bg-ink px-3 py-1.5 text-sm font-semibold text-paper disabled:opacity-40">
                      Open with passkey key
                    </button>
                  )}
                  <button type="button" onClick={() => removeEntry(e.id).then(refresh)} className="border border-ink/30 px-3 py-1.5 text-sm">
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
