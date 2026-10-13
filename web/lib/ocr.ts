"use client";

import { parseReceipt, type ParsedReceipt } from "./receipt-parse";

/** In-browser OCR (tesseract.js, loaded on demand; language data fetched from its CDN).
 *  The image never leaves the device. */
export async function readReceipt(file: Blob, onProgress: (p: number) => void): Promise<{ text: string; fields: ParsedReceipt }> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return { text: data.text, fields: parseReceipt(data.text) };
  } finally {
    await worker.terminate();
  }
}
