# Compliance

**This repository is a testnet hackathon demo. It does not distribute securities.**

## Demo / testnet (what this repo does)

- Brand assets are `MockBrandAsset` tokens named e.g. *"Mock Nike Exposure (TEST)" / `mNKE`*. They are **fictional test tokens**. They are **not** securities, **not** issued by, affiliated with or endorsed by Nike, Starbucks, Apple or Robinhood, and they have **no redemption value**.
- Every mock contract reverts if deployed on Robinhood Chain mainnet (4663) or Arbitrum One (42161). `DeployStockback.s.sol` runs only on 31337, 46630 and 421614.
- USDG in the demo is `MockUSDG`, not Paxos USDG.
- `EligibilityPolicy.jurisdiction` is unset, so there is no geographic gate. That is acceptable only because nothing of value is distributed.

## Production (what would be required, not implemented)

Tokenized equities on Robinhood Chain are issued under the issuer's terms. The project's planning notes (`idea.md`) mention jurisdiction restrictions on those tokens. We have **not** verified the current issuer terms and draw no legal conclusions. Any production deployment that rewards users with exposure to real tokenized securities would at minimum require:

1. **Issuer authorization** to hold and allocate the asset in a pooled vault and to distribute exposure as rewards.
2. **Legal review** in every target jurisdiction: securities law, promotions and inducements, consumer rewards, tax treatment of reward income.
3. **KYC / eligibility** via an approved provider plugged into `IJurisdictionPolicy`. The architecture supports this without code changes elsewhere.
4. **Asset eligibility and transfer / redemption rules** matching the issuer's terms. The vault may need transfer restrictions that the MVP does not have.
5. **Merchant agreements** for funding and attestation.

## Design choices that keep compliance an adapter

- Geography is never hardcoded. It lives behind `IJurisdictionPolicy.isEligible(claimant, brandId)`.
- Per-brand activation (`EligibilityPolicy.BrandRules.active`) lets an operator enable only assets it is authorized for.
- Rewards are paid in whatever ERC-20 the brand vault holds. The same code can hold a stablecoin, a points token or an authorized tokenized asset.
