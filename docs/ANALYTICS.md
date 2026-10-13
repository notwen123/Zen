# Analytics

All metrics come from events. Events carry IDs and hashes only (see `PRIVACY.md`). **No traction numbers are claimed. The only deployments so far are local and test.**

## Events

| Contract | Event | Key fields |
|---|---|---|
| ReceiptCommitmentRegistry | `PurchaseCommitted(claimId, nullifier, claimant, brandId, merchantId, amount, currency)` | one per accepted claim |
| ReceiptCommitmentRegistry | `RewardAllocated(claimId, brandId, claimant, assets, shares)` | reward paid |
| ReceiptCommitmentRegistry | `VerifierUpdated`, `EligibilityPolicyUpdated`, `RewardPolicyUpdated`, `Paused` | governance audit trail |
| RewardPolicy | `BrandConfigSet(brandId, config)`, `RegistrySet` | rate and cap changes |
| EligibilityPolicy | `BrandRulesSet`, `MaxPurchaseAgeSet`, `JurisdictionPolicySet` | rule changes |
| RewardPool | `BudgetFunded(brandId, sponsor, amount)`, `BudgetAllocated`, `BudgetWithdrawn` | budget flows |
| BrandVaultFactory | `BrandVaultCreated(brandId, vault, asset)` | brand onboarding |
| USDGRewardAdapter | `FundedWithUSDG(brandId, sponsor, usdgIn, assetOut)` | USDG funding |
| BrandVault (ERC-4626) | `Deposit`, `Withdraw`, `Transfer` | ownership changes |

Rejected claims revert, so they emit nothing. Count them from failed transactions to the registry, decoding `ClaimRejected(uint8 status)` (selector from `cast sig "ClaimRejected(uint8)"`). The frontend's `previewClaim` calls are off-chain and not counted.

## Metric definitions

| Metric | Definition |
|---|---|
| Claims submitted | successful `submitClaim` txs + reverted `submitClaim` txs |
| Claims verified | count of `PurchaseCommitted` |
| Claims rejected (by reason) | reverted txs grouped by decoded `ClaimRejected.status` |
| Verification rate | verified / submitted |
| Unique users | distinct `claimant` in `PurchaseCommitted` |
| Unique brands | distinct `brandId` in `RewardAllocated` |
| Reward volume (per brand) | Σ `RewardAllocated.assets` grouped by `brandId` (units differ per brand, so never sum across brands) |
| Vault shares issued | Σ `RewardAllocated.shares` |
| Average reward | reward volume / verified, per brand |
| Daily claims | `PurchaseCommitted` grouped by `block_time::date` |
| Repeat users | claimants with ≥ 2 `PurchaseCommitted` on distinct days |
| Claim-to-ownership conversion | users still holding vault shares after N days / users rewarded |
| Budget runway | `RewardPool.budgetOf(brand)` / trailing 7-day average `RewardAllocated.assets` |

Example (Dune-style SQL, decoded tables):

```sql
select date_trunc('day', evt_block_time) as day,
       count(*)                           as verified_claims,
       count(distinct claimant)           as users
from stockback.ReceiptCommitmentRegistry_evt_PurchaseCommitted
group by 1 order by 1;
```
