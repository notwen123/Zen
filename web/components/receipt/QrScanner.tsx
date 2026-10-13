"use client";

import { useEffect, useRef, useState } from "react";
import { Arrow, Button } from "@/components/ui/Button";

// Native BarcodeDetector (Chrome/Edge/Android). Not in TS's DOM lib yet.
type Detector = { detect(src: CanvasImageSource | ImageBitmap): Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (o: { formats: string[] }) => Detector;
  }
}
const makeDetector = () => (typeof window !== "undefined" && window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null);

/** Reads a merchant receipt QR from the camera, an image, or pasted text. Calls onResult with the raw content. */
export function QrScanner({ onResult, onBack }: { onResult: (text: string) => void; onBack: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  // Only rendered after a user action (never server-rendered), so reading window here is safe.
  const [supported] = useState(() => !!makeDetector());
  const [camError, setCamError] = useState<string>();
  const [text, setText] = useState("");
  const done = useRef(false);

  useEffect(() => {
    const detector = makeDetector();
    if (!detector || !navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (stopped || done.current) return;
      const v = video.current;
      if (v && v.readyState >= 2) {
        const [hit] = await detector.detect(v).catch(() => []);
        if (hit?.rawValue && !done.current) {
          done.current = true;
          return onResult(hit.rawValue);
        }
      }
      timer = setTimeout(tick, 250);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        tick();
      })
      .catch(() => setCamError("Camera unavailable. Upload a photo of the QR or paste the receipt link."));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  async function fromImage(file?: File) {
    const detector = makeDetector();
    if (!file || !detector) return;
    const [hit] = await detector.detect(await createImageBitmap(file)).catch(() => []);
    if (hit?.rawValue) onResult(hit.rawValue);
    else setCamError("No QR code found in that image.");
  }

  return (
    <div className="grid items-start gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-14">
      <div className="mx-auto w-full max-w-sm">
        <div className="relative aspect-square overflow-hidden border border-ink/15 bg-ink">
          {supported && !camError ? (
            <video ref={video} playsInline muted className="h-full w-full object-cover" />
          ) : (
            <p className="grid h-full place-items-center p-8 text-center text-sm text-paper/80">
              {supported === false ? "This browser can't read QR codes in the app. Point your phone camera at the QR instead, or paste the link." : camError}
            </p>
          )}
          <div className="pointer-events-none absolute inset-[18%] border-2 border-vermilion/80" aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.24em] text-muted">Merchant-signed receipt</p>
        <h2 className="mt-3 font-display text-3xl font-bold">Scan the merchant&apos;s QR.</h2>
        <p className="mt-2 text-sm text-charcoal">
          The QR carries a receipt signed by the merchant. We check that signature before anything is claimed, so changing the amount, brand or receipt ID breaks it.
        </p>
        {supported && (
          <label className="ink-link mt-5 inline-block cursor-pointer text-sm">
            Or upload a photo of the QR
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => fromImage(e.target.files?.[0])} />
          </label>
        )}
        <label className="mt-6 block">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-muted">Or paste the receipt link</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="https://…/app/scan#r=SBR1…"
            className="mt-1.5 w-full border-b border-ink/30 bg-transparent py-2 font-mono text-xs outline-none focus:border-vermilion"
          />
        </label>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => onResult(text)} disabled={!text.trim()}>
            Use this receipt <Arrow />
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
