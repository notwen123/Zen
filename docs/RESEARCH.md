# Research: gaps in STOCKBACK and the painkiller version

October 2026. Every number below comes from the cited paper. Where we have no source, we say so.

## TL;DR

The vitamin is "earn stock instead of points." That's nice, but nobody's day is broken without it.

**The painkiller is proof of purchase anchored in a signature, not in pixels.** Receipt photos stopped being reliable evidence in 2026.
Any reward, refund, warranty or expense flow that trusts pixels is now paying out on forgeries. STOCKBACK
already has the right on-chain half:
- an Ed25519 signature checked by Stylus at 1/9 the gas
- one nullifier per purchase
- an admin-less vault that no admin can dilute, freeze or expire (the underlying asset's value can still change)

What's missing is moving the *trust origin* from pixels to the source: the merchant's or the payment rail's
signature. We also need to stop paying out instantly.

---

## 1. What the literature says

### 1.1 Receipt photos are no longer evidence

| Finding | Source |
|---|---|
| Humans picking the forged receipt **side by side** score **0.501**, which is chance (N=120, 365 pair votes) | Wu et al., *When the Forger Is the Judge*, [2604.25213](https://www.alphaxiv.org/abs/2604.25213) |
| GPT-Image-2 replaces a number on a receipt "in under a second for a few cents" | same |
| Best forensic detectors reach AUC 0.599 (TruFor) and 0.585 (DocTamper), down from 0.96 and 0.85 on traditional tampering. The generator judging its own output scores 0.532 | same |
| Entrust 2025: digital document forgeries up **244% YoY**, with an AI-manipulated document attempt every five minutes (quoted in the paper) | same |
| On older GPT-4o receipts, LLM judges caught forgeries mainly through **arithmetic errors**. Detection holds about 94% without them, but the authors warn that hardened forgeries close both gaps | Zhang et al., *GPT4o-Receipt*, [2603.11442](https://www.alphaxiv.org/abs/2603.11442) |
| Refund fraud with AI-edited "damage" photos: MLLMs catch only **0.23** of fakes and keep 0.94 of real ones. Specialised detectors raise false accusations against honest customers | Yan et al., *FraudBench* (NTU and Alibaba), [2605.08820](https://www.alphaxiv.org/abs/2605.08820) |

**Implication for us.** Our live attester OCRs a photo and signs what it reads. That makes it a
forgery-to-signature converter. The signature, Stylus check and nullifier are all sound, but they faithfully
certify a fake. This is the #1 gap and the first question a technical judge will ask.

### 1.2 You can prove where data came from, without the server's help

- DECO, [1909.00938](https://www.alphaxiv.org/abs/1909.00938), lets a user prove that data came from a
  specific TLS website. It can also prove a statement about that data in zero knowledge, e.g. "the order total
  was at least ₹2,000", without revealing the rest.
  - No trusted hardware and no server changes.
  - Cost: about 5 s online and 3–13 s to generate the proof.
- Their worked examples include proving an order price and a "legacy credential to anonymous credential"
  conversion. That is exactly "prove this purchase happened" from an order-confirmation page, bank statement
  or UPI history, with no PII revealed.

**Implication.** Proving a purchase at the source is practical. The approach is shipping as zkTLS, e.g.
TLSNotary, reviewed in [2409.17670](https://www.alphaxiv.org/abs/2409.17670).

### 1.3 Generative AI creates a "trust valley" that new programs fall into

Yin & Wen, [2609.27404](https://www.alphaxiv.org/abs/2609.27404) (Economics Letters):
- When forging becomes cheap *before* checking is worthwhile, claim credibility collapses.
- High-trust markets verify *later*, so fraudsters move into them first ("trust arbitrage").

A new rewards program that launches trusting photos is the high-trust, unverified market. **Verify at the
source from day one.**

### 1.4 Paying instantly cannot be defended against sybils

Javarone, Leonardos & Ventre, [2609.13064](https://www.alphaxiv.org/abs/2609.13064):
- **With no vesting window (T = 0), no audit rate deters farming.** If the reward is worth more than the cost
  of faking a claim, the attack grows without bound.
- Deterrence holds when `q_F^T · R ≤ k_F + T · L(a) · F`. Vesting, audits and a forfeitable penalty enter
  *together*.
- They recommend non-transferable baseline rewards, claim caps, selective audits and delayed vesting for
  high-value benefits.

Luo et al., [2503.14316](https://www.alphaxiv.org/abs/2503.14316), studied the sybil hunters reported on the
Hop airdrop:
- **69.3%** of hunter groups would have made a profit if undetected.
- The typical tells are one funder or one common receiver, and uniform activity.

**Implication.** We pay vault shares the instant a claim lands, so T = 0. Our per-*address* daily cap is
bypassed with a new wallet. What saves us is that our nullifier is per *receipt*, not per person. If the
receipt is genuine, a "sybil" with real receipts is just a real customer. **Stronger evidence shrinks the sybil
problem:** extra wallets don't help without receipts the merchant actually signed. That holds only while the
merchant key is not compromised, and it is no proof of personhood. Add a hold window anyway, because refunds exist.

### 1.5 Why loyalty programs fail users and merchants

Oamen et al., [2512.00738](https://www.alphaxiv.org/abs/2512.00738), citing Bond Loyalty Report 2020 and others:

| Pain | Number |
|---|---|
| Programs a consumer belongs to vs. actively uses | **14.8 vs 6.7** |
| Consumers who find loyalty programs too complicated | **73%** |
| Unaware which programs they belong to | **54%** |
| Inactive coalition members | **45%** |
| Coalition programs that fail within 10 years | **~60%** (Plenti shut down in 3 years after $100M+) |
| Operator fees in coalitions | **10–30%** of transaction value |
| Air Miles 2016 points-expiry policy | Mass backlash and government scrutiny, then reversed |

The authors' structural diagnosis is that the centralised operator causes several problems:
- it erodes brand identity, because everything becomes generic coalition points
- it holds the brand's data hostage
- it rent-seeks
- it can devalue or expire value at will

They propose brand-sovereign programs, interoperable through trustless contracts and a universal settlement
asset such as a stablecoin.

**Implication.** Our design already matches their recommended architecture:
- a per-brand vault keeps brand identity (sbNKE, not "points")
- no operator takes a cut
- USDG is the universal asset

The admin-less ERC-4626 vault is the one thing a points program **cannot** promise: *no admin can dilute, freeze
or expire your shares.* That is enforced by code, not by a policy page. The market value of the underlying asset can
still fall; that is a real risk, not a promise.

---

## 2. Gaps in STOCKBACK today

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G1 | **Trust origin is a photo.** The attester signs OCR output, so a forged receipt gets a valid signature. | Critical | §1.1, §1.3 |
| G2 | **Instant payout (T = 0).** No window for refunds or audits. Returned goods keep their reward. | High | §1.4 |
| G3 | **Per-address caps** are trivially sybilled. They only matter while G1 is open. | Medium | §1.4 |
| G4 | **Single trusted attester key.** One compromise mints rewards up to the caps. | Medium | our own threat model, `SECURITY.md` |
| G5 | **Value prop framed as a vitamin** ("own a slice of the brand") rather than a broken workflow. | Pitch | §1.5 |
| G6 | **Brand-side value is unproven.** Brands fund the pool, but we show them no incremental-purchase evidence. We have no paper for this; it needs merchant interviews. | Unknown | — |

Things we got right that the papers back:
- a per-receipt nullifier rather than per-identity
- daily brand budget caps, as Javarone et al. recommend
- no PII on-chain, only salted hashes, which matches DECO's selective-disclosure model
- a brand-sovereign vault instead of a coalition operator, as Oamen et al. recommend

---

## 3. The painkiller version

> **STOCKBACK: proof of purchase from a signature rather than a photo, paid in brand-vault shares no admin can dilute or expire.**

### 3.1 Who hurts today, and how

- **Merchants and brands** pay out on forged receipts and AI-faked refund evidence (§1.1). Their only defence
  is detectors that are near chance and falsely accuse honest customers (FraudBench). Coalitions charge them
  10–30% and keep their data (§1.5).
- **Shoppers** juggle 14.8 programs, find 73% of them too complicated, and watch points expire or get
  devalued (§1.5).

### 3.2 What changes: trust moves from pixels to the source

Evidence tiers. The on-chain path stays identical; only the off-chain signer's *input* changes.

| Tier | Evidence | Who signs | Forgeable by GPT-Image-2? | Reward policy |
|---|---|---|---|---|
| **A** | Merchant-signed receipt QR (POS signs at sale time with an Ed25519 key) | Merchant | Not without the merchant key (a key leak breaks this) | Full rate, short hold |
| **B** | zkTLS proof of an order email or bank/UPI record (DECO / TLSNotary) | Payment or commerce site, via the TLS session | Not without breaking the TLS-proof protocol (assumptions in DECO §3) | Full rate, hold equal to the return window |
| **C** | Photo + OCR (today's demo) | Our attester | **Yes** | Capped low, long hold, sampled audit |

Tier A needs no contract change. The POS signs `{merchantId, receiptHash, amount, purchasedAt}`. The user
scans the QR. Our attester **verifies the merchant signature instead of reading pixels**, then issues the
existing wallet-bound `PurchaseClaim` that Stylus verifies on-chain. The same Ed25519 primitive we
benchmarked at 9.2× cheaper is the one merchants would sign with.

### 3.3 What changes: rewards vest over the return window (closes G2)

- Shares are minted into escrow and released after `holdPeriod` per brand, e.g. 7–30 days.
- A refund or chargeback signed by the merchant voids the claim before release.
- This turns the Javarone et al. condition from "impossible" (T = 0) into a tunable deterrent. It also fixes
  the real merchant leak of rewarding purchases that are later returned.

### 3.4 What we deliberately don't claim

- These are not securities and not real brand equity. The vault assets are labelled demo assets on testnet.
- We have no merchant partnerships, and no source for how often paper receipts are lost for warranty claims.
  Both are open questions, not claims.

---

## 4. Plan before the deadline (Oct 4, 21:29)

> **Status, Oct 2:** items 1–3 are done.
> - Tier 1 shipped as `/merchant` plus QR scan, with a **simulated** merchant. It is tested and claimed on testnet; see `SECURITY.md`.
> - Item 4 (hold window) is deferred to avoid redeploying live contracts.
> - Item 5 remains roadmap.

Ordered by judge impact per hour. Nothing below changes deployed contracts unless stated.

1. **Tier A demo (web only, about half a day).**
   - Add a `/merchant` "POS" page that signs a receipt QR with a demo merchant key, clearly labelled.
   - Make the scan flow accept that QR. The attester verifies the merchant signature, then signs the claim.
   - Keep OCR as Tier C with a visible "lowest trust" label.
2. **Evidence-tier labels** in the claim UI and on the landing page (an hour). Be honest about which tier the
   demo uses.
3. **Pitch rewrite:** README hero, `HACKATHON.md`, landing copy → "proof from a signature, not a photo" with the
   §1.1 numbers (an hour).
4. **Hold window (contract change, needs a redeploy).** This is a `ClaimEscrow`, or a `releaseAt` on vault
   mint plus `void(claimId)` for refunds. ⚠ The deployer has about 0.0006 ETH, so we'd need testnet ETH
   before redeploying. Optional: if we skip it, document it as the next step with the §1.4 math.
5. **zkTLS (Tier B):** roadmap only. Cite DECO and TLSNotary. Building it in two days isn't realistic.

## References

- Wu et al. 2026, *When the Forger Is the Judge: GPT-Image-2 Cannot Recognize Its Own Faked Documents*, arXiv:2604.25213
- Zhang et al. 2026, *GPT4o-Receipt: A Dataset and Human Study for AI-Generated Document Forensics*, arXiv:2603.11442
- Yan et al. 2026, *FraudBench: Detecting AI-Generated Fraudulent Refund Evidence*, arXiv:2605.08820
- Zhang, Maram, Malvai, Goldfeder, Juels 2020, *DECO: Liberating Web Data Using Decentralized Oracles for TLS*, CCS '20, arXiv:1909.00938
- Yin & Wen 2026, *When Trust Attracts Fraud: AI and Trust Arbitrage*, Economics Letters, arXiv:2609.27404
- Javarone, Leonardos & Ventre 2026, *NFT-Based Reward Mechanisms: Sybil Farming, Vesting, and Stochastic Verification*, arXiv:2609.13064
- Luo, Kang, Zheng & Liu 2025, *Toward Resilient Airdrop Mechanisms*, arXiv:2503.14316
- Oamen, Wesley & Onobhayedo 2025, *Orchestrating Rewards in the Era of Intelligence-Driven Commerce*, arXiv:2512.00738
