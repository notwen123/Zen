# Zen at Monad Metropolis

**Track:** Onchain Finance & Trading. **Direction #12:** tokenized equities as a programmable asset, i.e. a contract that locks, streams, conditions, or distributes the equity itself.

**One line:** every stock-back reward is a locked, conditional equity claim, because the purchase can be refunded. Zen makes that claim a tradeable asset and creates the first onchain market that prices consumer refund risk, settled on Monad.

How Zen answers direction #12 in contract terms: the equity is **locked** (escrow until `purchase + returnWindow`), **conditioned** (a refund proof voids it before unlock), **distributed** (settled to whoever holds the claim) and made **tradeable while conditional** (the InstantExitPool buys it at a risk-priced discount).

Every claim below links to code, a test or an on-chain transaction. Nothing here claims users, partners, revenue or an audit; none exist. All equity tokens are labelled mocks.

---

## Technical (20%)

| Evidence | Where |
|---|---|
| Three new contracts with no proxies and no admin over user funds: `ConditionalClaim` (ERC-721 positions, escrow, Locked → Voided / Settled), `VoidOracle` (EIP-712 refund attestations + refund nullifier), `InstantExitPool` (ERC-4626 per equity token, on-chain pricing, book-cost accounting) | `src/` |
| Existing receipt pipeline rewired: `submitClaim` now mints a conditional claim in the same transaction (nullifier, eligibility, caps, budget unchanged) | `src/ReceiptCommitmentRegistry.sol`, `src/RewardPool.sol` |
| **96 tests + 6 invariants, all passing** under Foundry 1.8.5 with `network = "monad"`: full lifecycle (sell → settle gain, sell → void loss), guards (min hold, slippage, void after unlock, replayed refund, non-attester), ERC-4626 share math with gains and losses, pricing fuzz (`price ≤ amount`, monotonic), invariant `escrowed == Σ Locked amounts` | `test/ConditionalLifecycle.t.sol`, `test/Invariant.t.sol` |
| Monad-specific engineering: tight explicit gas limits everywhere (Monad bills the gas limit), deploy script refuses chains other than 31337 / 10143 / 143, mocks refuse mainnet, the app reads by claim-id enumeration because the public RPC caps `eth_getLogs` at 100 blocks | `script/DeployZen.s.sol`, `web/lib/chain.ts`, `web/lib/zen.ts` |
| **Envio HyperIndex** indexer (`indexer/`) on Monad testnet via HyperSync: claims, cash-outs, refunds, settles, LP flows and per-wallet refund history with tx hashes; full backfill in ~7 s; indexed realized gains/losses equal the on-chain pool values | `indexer/`, `web/components/indexer/MarketTape.tsx` |
| Resolution callback can't be griefed: gas-capped `try/catch` plus a permissionless `reconcile` | `src/ConditionalClaim.sol`, `src/InstantExitPool.sol` |

## Design (20%)

| Evidence | Where |
|---|---|
| Shopper: **My locked equity** with live countdown to unlock, labelled *demo window*, and **Cash out now** showing the live quote, the discount % and a plain-language sentence of what you give up | `web/app/app/portfolio` |
| **LP terminal**: pool NAV, idle vs capital in claims, held claims with countdowns, per-category refund probability, expected APR with its formula and assumptions, realized gains and losses, deposit and withdraw, and a visible **risk disclosure**; every number is read from chain | `web/app/app/lp` |
| Merchant demo: issue signed receipts, and **Issue refund** to trigger a void (shows the LP-loss path) | `web/app/(site)/merchant` |
| **Passkey accounts (Mera)**: no extension or seed phrase; one passkey derives the Monad signing account and, separately (HKDF `zen-receipt-locker-v1`), the AES-GCM key of the encrypted **Receipt Locker**; testnet faucet for new accounts | `web/lib/account.tsx`, `web/app/app/locker` |
| Honest labels throughout: demo windows, mock assets, simulated merchant, demo admin | UI + README |

## Originality (15%)

- Stock-back products (Bumped, Bits of Stock, Bitget Wallet Assetback, Crumbs) pay rewards or keep them "pending". None represents the reward as what it is, a **conditional** equity claim, and none prices the refund risk.
- Zen turns the return window into an asset with a price: `amount × (1 − pRefund × walletRisk) × (1 − timeValue) × (1 − fee)`. LPs take the other side of **consumer refund risk**, a risk that has no on-chain market today.
- Adverse selection is addressed in the mechanism (minimum hold, wallet refund history kept against the original claimant, signed and nullified refund proofs), not left to policy.

## Founder & Market (25%)

| Evidence | Source |
|---|---|
| $849.9B of US retail returns expected in 2025; 9% fraudulent | [NRF & Happy Returns, 2025](https://nrf.com/research/2025-retail-returns-landscape) |
| $103B lost to return fraud and abuse in 2024 | [Appriss Retail & Deloitte](https://apprissretail.com/news/appriss-retail-annual-research-fraudulent-returns-and-claims-cost-retailers-103b-in-2024/) |
| Bumped, the brand-funded stock-reward app, shut down in December 2022 after ending rewards that July; brands paid for every share | [Doctor of Credit](https://www.doctorofcredit.com/bumped-app-earn-stock-rewards-on-retail-purchases-by-linking-a-card/) |
| Stock-back is live again with tokenized equities (Bitget Wallet Assetback, from 1 Aug 2026) | [GlobeNewswire](https://www.globenewswire.com/news-release/2026/08/01/3337111/0/en/bitget-wallet-card-turns-cashback-into-bitcoin-gold-and-tokenized-stocks.html) |
| Positioning: the settlement and refund-risk layer for stock-back issuers, not another rewards app | README → Competition |
| First users: LPs who want returns uncorrelated with crypto; stock-back issuers are **target** customers (no partnerships exist) | README → First users |
| The team built the receipt-verification core first (prototype) and found its real gap: rewards paid on day 0 on purchases that can still be refunded. Zen is the answer to that gap. | `git log` |

## Traction (20%)

Real Monad testnet transactions from 4 wallets (3 shoppers + 1 LP), recorded in `deployments/10143-activity.json` and listed in the README: 20 verified purchases minted as conditional claims across fashion, electronics and food; LP deposits into all three exit pools; 8 instant exits; 2 refunds (one pool-held: a real LP loss); the remaining claims settled after their labelled demo windows, the pool-held ones as realized LP gains. These are test trades by the team, not users.

---

## Built during Monad Metropolis

The first commit imports the earlier prototype as a baseline (`chore: import STOCKBACK prototype`). Everything after it was built in the window: the conditional-claim lifecycle, VoidOracle, InstantExitPool, pricing and adverse-selection defenses, their tests and invariants, the Monad migration (Foundry Monad execution, gas-limit handling, deploy script, AUSD), the testnet deployment and seeded activity, the LP terminal, the locked-equity and cash-out UI, and the refund flow. The prototype's non-EVM signature verifier and its benchmark were removed; Zen verifies attestations with plain ECDSA on Monad.

## Submission checklist

- [x] Contracts deployed on Monad testnet (`deployments/10143.json`)
- [x] Seeded testnet activity with tx hashes (`deployments/10143-activity.json`)
- [x] Tests: 96 + 6 invariants passing
- [x] README with pitch, how it works, why Monad, pricing, adverse selection, market, competition, traction, next steps, security, addresses, quickstart
- [ ] Logo (human)
- [ ] Demo video ≤ 3 min (human)
- [ ] Pitch video ≤ 2 min (human)
- [ ] Repo access for metropolis@hackathon.monad.xyz (human)
- [x] Hosted web app: https://zen-monad.pages.dev (Cloudflare Pages → Workers; secrets as Worker secrets)
