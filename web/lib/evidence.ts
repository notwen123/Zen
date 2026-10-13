/** Evidence tiers: what a claim's proof actually establishes. Shown wherever a claim is made. */
export const EVIDENCE = {
  "merchant-signed": {
    tier: 1,
    label: "Merchant-signed demo receipt",
    short: "Merchant-signed",
    body: "Signature verified: no field changed since the merchant signed it. The merchant itself is simulated, not a real partner.",
    status: "Live demo",
  },
  "attested-entry": {
    tier: 2,
    label: "Attested photo / OCR",
    short: "Attested entry",
    body: "Read from a photo or typed, then signed by the demo attester. That a real purchase happened is not independently established.",
    status: "Live demo",
  },
  "verified-payment": {
    tier: 3,
    label: "Verified payment / order evidence",
    short: "Payment proof",
    body: "Proof from the payment or order source itself (e.g. zkTLS). Roadmap, not implemented.",
    status: "Roadmap",
  },
} as const;

export type Evidence = keyof typeof EVIDENCE;
