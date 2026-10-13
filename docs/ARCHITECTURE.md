# Architecture

STOCKBACK has four layers with one-way dependencies: **Evidence → Proof → Eligibility → Ownership**.

## 1. System architecture

```mermaid
flowchart TB
    subgraph OFF["Off-chain (raw data never leaves here)"]
        R["Receipt / UPI ref / invoice"] --> A["Attester<br/>(merchant, payment API;<br/>demo: tools/attester.mjs)"]
    end

    subgraph PROOF["Proof layer"]
        REG["ReceiptCommitmentRegistry<br/>commitment + nullifier + pause"]
        V1["ECDSAAttestationVerifier<br/>(Solidity, secp256k1)"]
        V2["ReceiptProver<br/>(Stylus / Rust, Ed25519)"]
    end

    subgraph ELIG["Eligibility layer"]
        EP["EligibilityPolicy"] --> JP["IJurisdictionPolicy<br/>(optional KYC / region adapter)"]
        RP["RewardPolicy<br/>rate, caps"]
    end

    subgraph OWN["Ownership layer"]
        POOL["RewardPool<br/>sponsor budget"]
        F["BrandVaultFactory"]
        F --> VN["BrandVault NIKE"]
        F --> VS["BrandVault SBUX"]
        F --> VA["BrandVault AAPL"]
        USDG["USDGRewardAdapter<br/>(optional)"] --> POOL
    end

    A -- "PurchaseClaim + attestation" --> REG
    REG -- "verify(digest, attestation)" --> V1
    REG -. "or" .-> V2
    REG -- "check(claim)" --> EP
    REG -- "quote / consume" --> RP
    REG -- "allocate(brand, user, amount)" --> POOL
    POOL -- "vault.deposit(amount, user)" --> VN
    VN --> U["User: vault shares"]
```

## 2. Purchase-to-ownership sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Frontend
    participant Att as Attester
    participant Reg as ReceiptCommitmentRegistry
    participant Ver as Verifier (ECDSA or Stylus)
    participant Eli as EligibilityPolicy
    participant Rew as RewardPolicy
    participant Pool as RewardPool
    participant Vault as BrandVault

    User->>App: scan receipt
    App->>Att: raw receipt (TLS, off-chain)
    Att->>Att: validate purchase, hash ids with secret salt
    Att-->>App: PurchaseClaim (hashes only) + signature
    App->>Reg: previewClaim(claim, attestation)
    Reg-->>App: (Ok, reward)
    User->>Reg: submitClaim(claim, attestation)
    Reg->>Reg: claimant == msg.sender, deadline, nullifier unused
    Reg->>Ver: verify(EIP-712 digest, attestation)
    Ver-->>Reg: true
    Reg->>Eli: check(claim)
    Eli-->>Reg: Ok
    Reg->>Rew: quote(claim), then budget check
    Reg->>Reg: burn nullifier, emit PurchaseCommitted
    Reg->>Rew: consume(claim) records daily usage
    Reg->>Pool: allocate(brand, user, reward)
    Pool->>Vault: deposit(reward, user)
    Vault-->>User: shares
    Reg-->>App: emit RewardAllocated
```

## 3. Contract dependencies

Arrows point from caller to callee. There are no cycles. The only contract that can spend budget or record cap usage is the registry.

```mermaid
flowchart LR
    REG[ReceiptCommitmentRegistry] --> IV[IReceiptVerifier]
    REG --> IE[IEligibilityPolicy]
    REG --> IR[IRewardPolicy]
    REG --> IP[IRewardPool]
    IV --> ECDSA[ECDSAAttestationVerifier]
    IV --> STY[Stylus ReceiptProver]
    IE --> EP[EligibilityPolicy] --> IJ[IJurisdictionPolicy]
    IR --> RP[RewardPolicy]
    IP --> POOL[RewardPool] --> IF[IBrandVaultFactory]
    IF --> F[BrandVaultFactory] --> BV[BrandVault ERC-4626]
    AD[USDGRewardAdapter] --> IP
    AD --> IF
    AD --> SR[ISwapRouter / SwapRouter02]
    AD --> OR[IAggregatorV3]
```

## 4. Trust boundaries

```mermaid
flowchart TB
    subgraph T0["Untrusted"]
        U[User wallet]
        MEM[Mempool / other users]
    end
    subgraph T1["Trusted for authenticity only"]
        ATT[Attester key]
    end
    subgraph T2["Trusted for configuration (owner key)"]
        OWN[Owner: verifier, policies, caps, pause, budget withdrawal]
    end
    subgraph T3["Trust-minimised (code only)"]
        REG[Registry: nullifier, claimant binding, domain separation]
        CAPS[RewardPolicy caps]
        POOL[RewardPool: budget accounting]
        VAULT[BrandVault: no admin at all]
    end
    U -->|claim + attestation| REG
    MEM -.->|copied attestation fails: claimant must be msg.sender| REG
    ATT -->|signs claims| REG
    OWN -->|bounded by caps + budget| CAPS
    OWN -->|can withdraw unallocated budget only| POOL
    OWN -. "no path" .-> VAULT
    REG --> CAPS --> POOL --> VAULT
```

What each party can do in the worst case:

| Compromised party | Worst case | Bound |
|---|---|---|
| Attester key | Sign fake purchases | Per-claim, daily-user and daily-brand caps; unallocated budget; owner can revoke the attester |
| Verifier contract | Say "valid" to anything | Same caps and budget; cannot move funds or change config |
| Owner key | Swap verifier or raise caps, withdraw **unallocated** budget | Cannot touch vault assets or user shares |
| User | Replay, alter or front-run claims | Nullifier, signature over all fields, claimant binding |

## 5. USDG reward flow (optional adapter)

```mermaid
flowchart LR
    S[Sponsor / merchant] -- "USDG" --> AD[USDGRewardAdapter]
    AD -- "oracle price, freshness check" --> O[Price feed]
    AD -- "exactInputSingle(minOut = oracle x (1 - slippage))" --> DEX[SwapRouter02]
    DEX -- "brand asset" --> AD
    AD -- "fund(brand, amount)" --> P[RewardPool budget]
    P -- "verified claims only" --> V[BrandVault shares]
```

`Reward Budget = Merchant Funding (+ any future yield contribution)`. No yield source is integrated or assumed.

## 6. Claim lifecycle

On-chain, a claim is atomic. It is either rejected, which reverts with `ClaimRejected(status)` and leaves no state behind, or it settles. A receipt rejected for a cap or budget reason can be resubmitted later because its nullifier was never burned.

```mermaid
stateDiagram-v2
    [*] --> Attested: attester signs claim
    Attested --> Rejected: malformed, expired, bad attestation, ineligible
    Attested --> Deferred: daily cap reached or budget exhausted
    Deferred --> Attested: next day or budget top-up (same signature, before deadline)
    Attested --> Settled: submitClaim succeeds
    Settled --> [*]: nullifier burned forever, shares minted
    Rejected --> [*]
```

## Economics (deterministic, integer-only)

```
reward = amount_minor_units × rateWad / 1e18 × multiplierBps / 10_000        (512-bit mulDiv)
reward = min(reward, perClaimCap)
require userIssued[brand][user][day]  + reward ≤ dailyUserCap
require brandIssued[brand][day]       + reward ≤ dailyBrandCap
require pool.budgetOf(brand)          ≥ reward
```

`rateWad` is a sponsor-set conversion ("brand-asset units per rupee"), in the same spirit as airline miles per rupee. It is not a market price. Config bounds: `multiplierBps ≤ 30_000`, `perClaimCap ≤ dailyUserCap ≤ dailyBrandCap`.

Demo parameters are in `script/DeployStockback.s.sol`: NIKE 0.75%, SBUX 1%, AAPL 0.5%, a per-claim cap of 100 units, a daily user cap of 300, and a daily brand cap of 100,000. 1e18 mock units stand for ₹1 of fictional demo exposure.
