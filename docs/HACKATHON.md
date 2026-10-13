# Hackathon Submission: Arbitrum Open House Singapore Buildathon 2026

**STOCKBACK: Proof-of-Purchase → Proof-of-Ownership.** *Scan. Prove. Own.*

A protocol that turns an **attested purchase receipt** into **pooled ownership exposure** in a brand-specific ERC-4626 vault, with replay protection, bounded rewards and no PII on-chain.

This document maps the build to the published judging criteria. It states what exists and what does not. It makes no claim about the outcome.

## Smart contract quality

- Eight single-purpose Solidity contracts (largest 7.3 KB runtime) plus one Stylus contract. No proxies, no god contract, no cycles (see `docs/ARCHITECTURE.md` §3).
- **Least authority**: the verifier is a `view` bool; only the registry can consume caps or spend budget; brand vaults have **no admin**.
- **83 Foundry tests**: unit, fuzz (1,000 runs) and 5 invariants (128 × 64 calls) covering replay, conservation of funds, vault solvency and daily caps. Plus 5 Rust tests (incl. all 100 shared benchmark vectors) and 4 benchmark correctness and gas tests. Every row of the security checklist maps to a test (`SECURITY.md`).
- Reuses audited OpenZeppelin v5 primitives (EIP712, ECDSA, ERC4626, Ownable, ReentrancyGuard, SafeERC20, Math.mulDiv).
- Found and fixed a real ABI mismatch inherited from the upstream code: the SwapRouter02 vs V3 struct, verified against deployed mainnet bytecode.

## Evidence: what is and isn't proven

| Tier | Evidence | Status |
|---|---|---|
| 1 | Merchant-signed demo receipt: Ed25519 over every field, verified before attestation. **Simulated merchant.** | Implemented, tested, claimed on testnet (`0xabd3b62b…5388`) |
| 2 | Attested photo / OCR: the attester signs what it was given, so authenticity is **not** established | Implemented |
| 3 | Verified payment / order evidence (zkTLS) | Roadmap, not implemented |

Why tiers matter: recent work shows humans detect AI-forged receipt photos at chance (0.501), and forensic detectors reach AUC 0.53–0.60. Sources and analysis are in `docs/RESEARCH.md`. A photo is therefore not treated as proof of purchase anywhere in the product.

## Product-market fit

- Loyalty points are closed-loop, expire and are illiquid. STOCKBACK rewards a purchase with exposure to the brand the customer actually buys from, held in a standard ERC-4626 vault the user controls.
- Merchants fund a capped, per-brand budget, directly or in USDG. Rules are public and deterministic (`RewardPolicy`), and sponsors can withdraw unallocated budget.
- **Who pays and why:**
  - Brands pay because they currently fund rewards on receipts they can't trust, and coalitions charge them 10–30% while keeping their customer data.
  - With STOCKBACK they pay only for merchant-signed purchases, within caps they set, with no operator in between.
- **Global protocol, rail-first launch:**
  - Currency is set per brand (ISO-4217 on-chain), geography is an `IJurisdictionPolicy` adapter, and funding is in USDG.
  - We launch where payments already carry a digital merchant trail: Singapore (PayNow/SGQR) and India (UPI, 24.07B payments in September 2026, NPCI).
  - The demo is priced in INR for that reason. A brand in SGD or USD is one `setBrandRules` call.
- **Not claimed**: users, merchants, partnerships, traction, or any measured fraud reduction or retention effect. None exist yet. The `/merchant` POS is a simulation.

## Innovation and creativity

- The primitive is the verification and eligibility pipeline: **evidence → attestation → commitment → nullifier → eligibility → capped reward → vault shares**. The vault is not the novelty.
- The nullifier is derived from `(merchantId, receiptHash)` only, so the same receipt cannot be re-claimed by changing claimant, amount, brand or deadline.
- A cap or budget rejection **does not burn** the receipt; it can be claimed later (explicit state machine).
- Verifier-agnostic proof layer: one ABI, two implementations. There is ECDSA in Solidity, and Ed25519 in **Stylus (Rust)**, the curve the EVM cannot verify natively.

## Real problem solving

- Anti-replay is enforced on-chain. Anti-Sybil is handled **honestly and partially**: caps, budgets and an optional KYC/jurisdiction adapter, with the limits written down (`SECURITY.md`, "Replay protection vs. Sybil resistance").
- Merchant-signed receipts move trust from pixels to a signature. Tests cover tampering of each field, the wrong key, expiry, unsupported brands, duplicates and fail-closed config (`npm test`, `npm run test:e2e`).
- Rewards settle instantly. There is **no** hold period for refunds yet (follow-up, needs new contracts).
- Privacy: raw receipts and UPI references never touch the chain. Receipt hashes are salted because short references are brute-forceable (`PRIVACY.md`).
- Compliance is an adapter, not hardcoded geography (`COMPLIANCE.md`). The demo uses clearly fictional mock assets that refuse to deploy on production chains.

## Stylus / Arbitrum

- `stylus/receipt-prover` passes `cargo stylus check` against **Robinhood Chain testnet**. The chain reports ArbWasm `stylusVersion() = 3`, and the StylusDeployer is present, both verified on-chain.
- Deployed on Robinhood testnet at `0x9ae8a390121ba71545e9923b333d60e7e3ccd3bd`, and it is the registry's active verifier. A real Ed25519-attested claim settled through it (tx `0x7fe2a51a…d9c4`).
- Measured on Robinhood testnet with identical calldata: Stylus Ed25519 is **5.3× (batch 1) to 9.2× (batch 50)** cheaper than the best available Solidity implementation, and it verifies 100 attestations in one transaction (6.58M gas), which Solidity cannot fit under the 32M cap. ECDSA via the EVM precompile remains cheaper than both. See `benchmarks/results/BENCHMARKS.md`.

## USDG

- `USDGRewardAdapter`: a sponsor pays the budget in USDG, which is swapped to the brand asset through SwapRouter02 with an oracle-bounded `minOut` and freshness checks, then credited to `RewardPool`.
- **Live on testnet:** tx `0x3d8de1490c0756b92e7e9a046419c1c14aa8913e4545a22171c2362715656c6d` emitted `FundedWithUSDG`, swapping 100 USDG into 10,000 mNKE and crediting the Nike reward budget.
- **No yield or APY is claimed.** On testnet, USDG is `MockUSDG`. Paxos USDG's Robinhood mainnet address is known from the Wield config (`config/networks.json`) but is not used.

## Robinhood Chain

- **Deployed on Robinhood Chain testnet (46630)**. Registry: `0x4273b12cD4A65c2180d4e65Bcb4254825cE64120`. All addresses are in `deployments/46630.json`.
- `script/demo.sh` ran end to end on testnet: claim, portfolio, replay rejected, USDG top-up.
- **13 claims from 3 wallets** have settled on the registry, including the merchant-signed, Stylus-verified claim recorded in the demo film (tx `0x1fc40e3e…7afa97`).
- The live web app (`stockbacks.vercel.app`) reads every balance and activity row straight from Robinhood Chain, with no indexer and no mocked state.

## Status checklist

| Item | Status |
|---|---|
| Claim model, commitment, nullifier, registry | done, tested |
| ECDSA verifier (Solidity) | done, tested |
| Ed25519 verifier (Stylus) | done, Rust-tested, `cargo stylus check` passes |
| Eligibility and reward policies | done, tested |
| BrandVaultFactory and ERC-4626 BrandVault | done, tested |
| RewardPool and USDG adapter | done, tested |
| End-to-end demo | done on anvil and Robinhood testnet (`script/demo.sh`) |
| Solidity benchmark | measured |
| Stylus benchmark | measured on Robinhood testnet |
| Robinhood testnet deployment | done (`deployments/46630.json`) |
| Consumer web app | done (`web/`): RainbowKit, OCR, attester API, real testnet claims |
| Merchant-signed receipts (tier 1) | done with a **simulated** merchant: `/merchant` POS, QR scan, signature verification, 20 unit + 22 integration checks, browser claim on testnet |
| Pending rewards / refunds, Sybil resistance, key-rotation tooling | not built (documented in `SECURITY.md`) |
| Payment/order-source proofs (zkTLS) | not built (roadmap) |
| Demo video | done: [2:30 film on YouTube](https://youtu.be/70fX_mN6MuE), real testnet claim on camera |
| Whitepaper / deck | done: `whitepaper/STOCKBACK-Whitepaper.pdf`, `brand/png/STOCKBACK-deck.pdf` |
