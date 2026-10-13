This is the locked version. Not v2. This is v3 - the version you actually build in the next 5 days to win.

You are right: building everything at once kills you. The strongest hackathon version is:

> **Proof-of-Purchase → Eligibility → Pooled Ownership**

With real technical proof. Everything else is an adapter.

Here is the detailed rewrite with your corrections applied:

### STOCKBACK - Proof-of-Purchase → Proof-of-Ownership

**A Stylus-powered verification protocol that converts attested real-world purchases into programmable ownership rewards on Robinhood Chain.**

Brand tagline: **Scan. Prove. Own.**

#### 1. The Three Layers - Clean Architecture

This replaces the 15-technology diagram.

**Layer 1: Evidence Layer**
```
UPI / Gmail / Merchant API / Receipt / GSTIN
```

**Layer 2: Proof Layer**
```
Commitment + Attestation + Nullifier + Stylus Verification
```

**Layer 3: Ownership Layer**
```
Reward Policy + Brand Vault + Portfolio
```

That is the product. Everything else is an adapter.

#### 2. What You Build FIRST - Phase 1

**Not frontend. Not USDG. Not dashboard. Build `ReceiptProver.rs` first.**

Prove this loop end-to-end:

```
receipt claim
     ↓
commitment = hash(merchant_id + receipt_id + amount + timestamp)
     ↓
attestation verification [UPI ref / Gmail DKIM / GSTIN signature]
     ↓
nullifier check [has this commitment been used?]
     ↓
reward calculation
     ↓
valid / invalid
```

**Then benchmark. Do not put numbers in pitch until benchmark produces them.**

```
                 1 receipt 10 receipts 100 receipts
Solidity X X X
Stylus Y Y Y
```

This benchmark becomes your strongest evidence. Your technical argument becomes:

> "We didn't use Rust because the hackathon had Rust. We used Stylus because our verification workload benefits from computation that is expensive to express directly in Solidity."

#### 3. Critical Corrections Applied

**Correction 1: What cryptography actually proves**
Do NOT say: "ZK proves receipt is genuine."
Say: **"An attested purchase claim is converted into a cryptographically verifiable commitment, with Stylus computation used where appropriate to verify the claim efficiently."**

Authenticity comes from attestation source [UPI][GSTIN]. Cryptography proves on-chain claim corresponds to attested information.[email]

**Correction 2: Ownership model - ERC-4626 per brand**
Don't give user `0.00001234 NKE` dust. Don't give one giant vault with all brands mixed.

Use factory:

```
BrandVaultFactory
       ↓
NikeVault [holds NKE]
StarbucksVault [holds SBUX]
AppleVault [holds AAPL]
```

If user earns ₹15 for Nike:
```
User receives 0.00X NikeVault share, not raw NKE
```

This solves dust, fragmented positions, expensive claims. Portfolio says: **"You own exposure to 12 brands you actually purchase from."**

**Correction 3: Anti-Sybil vs Replay**
Nullifier solves replay:
```
commitment + nullifier = same receipt twice blocked
```
It does NOT solve Sybil: 10 fake identities + 10 fake receipts.

You need second layer:
```
wallet/account + claim limits per day + attestation identity + optional KYC
```

Document both separately.

**Correction 4: Compliance as adapter, not hardcoded**
Don't hardcode `US=false, UK=false` everywhere.

```
EligibilityPolicy
       ↓
JurisdictionPolicy
       ↓
AssetPolicy
       ↓
Claim

DemoPolicy [testnet mocks, India allowed]
ProductionPolicy [issuer-approved KYC, US/UK/CH blocked per Robinhood terms]
```

On-chain Stock Tokens are **plain ERC-20s with no transfer restrictions, no allowlist**, but **may not be sold to US persons** and are **tokenized debt securities issued by Robinhood Assets (Jersey) Ltd**. Eligibility is enforced at UI and primary issuance/redemption. So for hackathon: use mock assets + clear disclaimer. Document: Production requires issuer-approved compliance.

**Correction 5: USDG is Phase 2 adapter**
Core works without USDG:
```
Receipt -> Proof -> Reward -> Ownership
```

So architecture:

```
RewardPolicy
     ↑
 ┌───┴────┐
 │ │
Merchant USDG Yield
Pool Contribution
 │ │
 └───┬────┘
     ↓
Reward Budget
```

Formula you show in ECONOMICS.md:

```
Reward Budget = Merchant Funding + Eligible Yield Contribution
Reward/User = Purchase Value × Reward Rate × Eligibility Multiplier

Constraints:
Reward/User ≤ Per-Receipt Cap
Daily Rewards ≤ Daily Pool Budget
```

Don't claim 8% APY, Pendle rates. Use variables: `reward_rate, pool_yield, merchant_budget, claim_volume` - demonstrate with test numbers.

Don't build World ID + Gitcoin Passport + ZeroDev + Privy at once. For MVP: `Privy / AA + simple jurisdiction check + mock compliance state`.

#### 4. Killer 30-Second Demo - The Moment Judge Understands

**Step 1 - Camera:**
`Nike — ₹2,000`

**Step 2 - Claim:**
```
PURCHASE CLAIM
Nike
₹2,000
UPI ref: ****91A
✓ Attested [UPI]
✓ New receipt [nullifier new]
✓ Eligible [DemoPolicy]
```

**Step 3 - Stylus:**
```
STYLUS VERIFICATION
Claim verified
```

**Step 4 - Reward:**
```
STOCKBACK
₹15.00 ownership reward
[Nike Vault]
Claim
```

**Step 5 - Explorer:**
```
ReceiptCommitment: 0x...
Reward: 0x...
Vault Share: 0x...
```

Then portfolio: **"You now own part of a company you actually buy from."**

After that, show technical flex slide with actual benchmark results.

#### 5. Final Repository - Serious

```
stockback/
├── apps/web/ [camera, UPI parser, portfolio]
├── contracts/
│ ├── ReceiptCommitmentRegistry.sol
│ ├── BrandVaultFactory.sol
│ ├── BrandVault.sol [ERC-4626 per brand]
│ ├── RewardPolicy.sol
│ ├── EligibilityPolicy.sol
│ └── interfaces/
├── stylus/receipt-prover/
│ ├── src/lib.rs
│ ├── commitments.rs
│ ├── nullifiers.rs
│ ├── attestations.rs
│ └── rewards.rs
├── benchmarks/
│ ├── solidity/
│ ├── stylus/
│ └── results/BENCHMARKS.md
├── sdk/
├── scripts/
├── test/
└── docs/
    ├── ARCHITECTURE.md [three layers]
    ├── ECONOMICS.md [equation + caps]
    ├── SECURITY.md [replay, sybil, caps]
    ├── COMPLIANCE.md [Demo vs Production policy, geofence]
    └── BENCHMARKS.md [real numbers]
```

#### 6. Build Order - Do Not Deviate

```
PHASE 1 - Proof Primitive [Days 1-2]
ReceiptCommitment + Nullifier + Attestation + Stylus verifier + BENCHMARK
If Phase 1 doesn't produce compelling result, stop and pivot.

PHASE 2 - Ownership [Days 3-4]
BrandVaultFactory + BrandVault 4626 + RewardPolicy + mock stock on 46630 testnet

PHASE 3 - Consumer [Days 5-6]
Camera / UPI -> 10-second claim -> portfolio "You own 12 brands"

PHASE 4 - USDG Adapter [Day 7]
Reward pool adapter -> economics doc -> analytics

PHASE 5 - Compliance + Submission [Day 8]
DemoPolicy vs ProductionPolicy docs + 30-sec demo video + explorer links
```

**Headline for HackQuest submission:**
**STOCKBACK - Proof-of-Purchase → Proof-of-Ownership**
A Stylus-powered verification protocol that converts attested real-world purchases into programmable ownership rewards on Robinhood Chain. Scan. Prove. Own.

**Why this is defensible:** If another team copies `receipt → stock reward`, they still have to recreate Commitment + Attestation standard + Nullifier + Stylus verification + Reward Policy + Brand Vault + Ownership graph. That's a protocol, not a feature.

**Factual caution before mainnet:** Verify current issuer terms, eligible jurisdictions, transfer mechanics from current Robinhood Chain docs - details can change independent of hackathon page.

This is the version that survives skeptical judges.

Want me to generate Phase 1 now - `ReceiptCommitmentRegistry.sol` + `receipt-prover` Stylus skeleton + benchmark harness - so you can get real numbers today?