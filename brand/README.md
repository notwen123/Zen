# STOCKBACK brand pack

Everything here is rendered from code (`src/`), so any asset can be regenerated after a copy or number change.

```bash
cd brand && npm install
npm run render          # all PNGs → png/   (or: node src/render.mjs posters)
node src/pack.mjs       # STOCKBACK-pitch.pdf + contact-sheet.png
```

Chromium comes from the Playwright cache; set `CHROME_PATH` to use another binary. Fonts load from Google Fonts at render time.

## The idea

**Every receipt, sealed.** In Japan a hanko (印) seal *is* a signature on paper. STOCKBACK's core is the same act in code: a merchant signs the receipt, and the signature, not the photo, is what counts.

- The round vermilion seal is the brand mark.
- The square 角印 stamped on receipts stands for the merchant's signature.
- The kanji 読 証 有 (read, prove, own) map to **Scan. Prove. Own.**

## What's in `png/`

| Folder | Files | Size | Use |
|---|---|---|---|
| `logo/` | seal (stamped, flat), wordmark (ink, reverse), stacked lockup, app icon (light, dark), favicons 32/180/192/512 | transparent PNG | Site, app, docs, slides |
| `posters/` | 01 Scan. Prove. Own. · 02 Every receipt, sealed · 03 9.2x less gas · 04 Counted once · 05 Owned, not pointed · 06 Live. Try it. | 2160×2700 (4:5) | Booth, print, Instagram, LinkedIn |
| `social/` | OG card, X header, LinkedIn banner, square, story | exact platform sizes | Link previews and profiles |
| `explainers/` | How it works · Who holds which key · Evidence tiers · Stylus benchmark · Inside one transaction | 3840×2160 | Docs, README, judges' Q&A |
| `pitch/` | Cover, two problem frames, solution, built and tested, honest roadmap, close | 3840×2160 | Slides |
| `guidelines/` | The seal · Colour and type | 3840×2160 | Anyone making new assets |
| `STOCKBACK-deck.pdf` + `deck/` | **The main deck.** 11 slides: intro, problem (forgery), problem (points), painkiller, uniqueness, market, architecture, live workflow, proof, impact, roadmap + close | 2.6 MB | Presenting to judges |
| `STOCKBACK-pitch.pdf` | 11 pages: the pitch frames and explainers in story order | 2.6 MB | Longer read-through, email |
| `contact-sheet.png` | Every image on one page | | Quick review |

**Placement notes:**
- **OG image:** `social/og-1200x630.png` is ready for `<meta property="og:image">`.
- **X header:** keep the left third clear, because the profile photo sits there.

## Rules

- **Colour:**

  | Name | Hex | Role |
  |---|---|---|
  | Washi | `#F4EFE3` | paper |
  | Sumi | `#171717` | ink |
  | Shu | `#C83A2F` | the seal, plus one emphasis per layout |
  | Deep shu | `#8F211D` | small red text |
  | Stone | `#8A8378` | muted |
  | Ai | `#2F6F9F` | indigo, second chart series only |

  The Ai/Shu chart pair passes a colour-vision-deficiency (CVD) separation check (ΔE 16.8, protan).
- **Type:**
  - Shippori Mincho 700–800 for display and kanji.
  - Instrument Sans for body text.
  - IBM Plex Mono only for real data: hashes, addresses, gas.
- **Seal:**
  - Use the stamped seal for hero moments and the flat seal under 64 px.
  - Keep half the seal's width clear on every side.
  - Don't recolour it, add shadows, or rotate it more than 12°.
- **Brands:** never put real brand logos (Nike, Apple, Starbucks) in marketing. The demo vaults use brand *names* only, with no partnership implied.
- **Voice:**
  - Plain verbs and sentence case.
  - Say what the thing does, not how great it is.
  - Every asset carries the testnet/mock disclaimer.

## Every claim, sourced

| Claim on an asset | Source |
|---|---|
| 9.2x / 5.3x less gas; 100 signatures in 6,583,441 gas; Solidity over the 32M cap | `benchmarks/results/BENCHMARKS.md`, `onchain-46630.md` (measured on Robinhood Chain testnet) |
| 50.1% human accuracy on AI-edited receipts; detector AUC 0.53–0.60; "under a second, a few cents" | Wu et al., arXiv:2604.25213 (2026) |
| 14.8 programs vs 6.7 used; 73% find them too complicated; ~60% of coalitions fail in 10 years | Bond Loyalty Report 2020 via Oamen et al., arXiv:2512.00738 |
| 24.07B UPI payments in September 2026 | NPCI UPI product statistics (npci.org.in) |
| Loyalty management market $13.6B (2025), $15.3B (2026), $31.1B projected 2033, 10.7% CAGR | Grand View Research, Loyalty Management Market Report 2026–2033 |
| +244% digital document forgeries YoY | Entrust 2025 Identity Fraud Report, cited in arXiv:2604.25213 |
| Workflow screenshots | Captured from the live app at stockbacks.vercel.app on 2026-10-02 |
| 100,000 demo units per brand per day bound | `RewardPolicy.config` read on-chain, see `SECURITY.md` |
| 83 Solidity, 5 Rust, 20 + 22 web tests | `forge test`, `cargo test`, `web/npm test`, `web/npm run test:e2e` |
| Registry, Stylus verifier, merchant-signed claim tx | `deployments/46630.json`, `README.md` |

Not claimed anywhere: merchant partnerships, users, traction, measured fraud reduction or retention effects. The merchant in the demo is simulated.

## Art credits

The ink-wash landscape, blossom sky and blossom strip in `src/art/` come from the project's own `public/` artwork. The seal, receipts, charts and diagrams are drawn in code.
