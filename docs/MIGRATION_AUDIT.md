# Migration Audit: Wield → STOCKBACK

Audit date: 2026-09-28. Source: `useWield/wield-contracts` @ `7dbc99e` (MIT, © 2026 Wield), checked out in `refrance/`.

Baseline before any change: `forge test` in the Wield tree → **52 passed, 0 failed** (Vault 10, VaultStock 10, BlendManager 11, P2PDesk 21).

## 1. Existing architecture (Wield)

| File | Role | Lines |
|---|---|---|
| `src/Vault.sol` | ERC-4626 over USDG. Owner whitelists underlyings (ERC-4626 "YIELD" or ERC-20 "STOCK" + Chainlink feed). A keeper (`agentDid`) signs `Intent{nonce, deadline, allocations}`; anyone relays it to `rebalance`, which sells everything and re-buys per bps via Uniswap V3. | 355 |
| `src/BlendManager.sol` | Splits one USDG deposit across ≤4 basket vaults, mints an ERC-721 position; `exit` redeems all legs. | 146 |
| `src/P2PDesk.sol` | EIP-712 signed maker orders, partial fills, never custodies assets. | 173 |
| `src/MockUSDG.sol` | 6-dec open-mint mock. | 16 |
| `src/interfaces/*` | `IAggregatorV3`, `ISwapRouter` (Uniswap V3 `exactInputSingle`), `IStockToken` (ERC-8056 `uiMultiplier`), `IAllocator` (unused). | |
| `script/*` | `Deploy`, `DeployAll` (mocks), `DeployBaskets` (mainnet, chain-id guard), `DeployP2P` (chain-id guard). | |
| `test/*` | Unit tests + mocks (`MockAggregatorV3`, `MockERC4626`, `MockStockToken`, `MockSwapRouter`, `MockUSDC`). | |

Toolchain: solc `0.8.24`, optimizer 200, OZ `5.1.0` @ `69c8def`, forge-std @ `6e8c4a9`, solady pinned but **unused**. `lib/` is not committed; CI (`.github/workflows/test.yml`) installs pinned commits and runs `forge fmt --check`, `forge build --sizes`, `forge test -vvv`.

## 2. Existing security model

- **Bounded agent authority**: keeper can only choose bps among owner-whitelisted assets; `MAX_BPS_PER_ASSET = 6000`; sum ≤ 10000.
- **Replay/domain**: monotonic `nextNonce`, `deadline`, digest binds `block.chainid` + `address(this)` (eth_sign prefix, not EIP-712). `P2PDesk` uses proper EIP-712 + `minNonce`.
- **Oracle**: `answer > 0`, `updatedAt` freshness (`oracleStaleAfter`, 48h at deploy); no double-applied split multiplier.
- **Slippage**: `minOut` derived from oracle, `maxSlippageBps` with 10% hard ceiling.
- **Pause** blocks new actions; exits always work (BlendManager, P2PDesk cancel).
- **CEI + `nonReentrant`** on state-changing user paths; `SafeERC20` + `forceApprove`.
- **Deploy guards**: `EXPECTED_CHAIN_ID` check, non-zero address checks.
- **Inflation**: relies on OZ v5 virtual shares; optional seed deposit.

## 3. Deployment model

Robinhood Chain **mainnet only** (chain `4663`), USDG `0x5fc5…d168`, Uniswap V3 router `0xCaf6…5cb2`, 4 stock tokens + Chainlink feeds (all listed in Wield README/.env). `foundry.toml` already declares `robinhood_testnet`/`robinhood_mainnet` RPC aliases. Nothing testnet-specific exists.

Verified during this audit (live RPC):
- `https://rpc.testnet.chain.robinhood.com` → chainId `46630`; ArbWasm `stylusVersion()` = 3 ⇒ **Stylus is available on Robinhood testnet**.
- Arbitrum Sepolia → chainId `421614`, `stylusVersion()` = 3.
- Not verified: any stock token, USDG, DEX or Chainlink feed on Robinhood **testnet**. STOCKBACK therefore uses labelled mocks on testnet.

## 4. Reuse decisions

| Wield component | Decision | Why |
|---|---|---|
| OZ ERC-4626 + virtual-shares approach | **Reused** in `BrandVault` (+ `_decimalsOffset() = 6`) | Correct, audited base; inflation resistance. |
| EIP-712 signing pattern (`P2PDesk`) | **Reused** for `PurchaseClaim` attestation digest | Chain-id + verifying-contract domain separation. |
| Oracle freshness + positivity checks, oracle-derived `minOut`, 10% slippage ceiling (`Vault._buyStockWithUsdg`) | **Reused** in `USDGRewardAdapter` | USDG→brand-asset funding path needs exactly this. Generalised to read token decimals instead of assuming 6/18. |
| `ISwapRouter`, `IAggregatorV3` | **Reused verbatim** | Same Uniswap V3 / Chainlink ABIs. |
| `MockUSDG`, `MockAggregatorV3` | **Reused** | Testnet/test mocks. |
| Chain-id deploy guard, non-zero checks | **Reused + extended** (mocks refuse chain 4663) | Prevent mock deployment to production. |
| Pause-new-actions / exits-always-work | **Reused** | Registry pause stops claims; vault redemptions never pausable. |
| CI workflow, pinned deps, `.gitattributes`, fmt gate | **Reused** | Same quality bar. |
| `Vault.sol` (agent rebalancing) | **Not carried over** | STOCKBACK has no discretionary rebalancing; a keeper with sell-everything/re-buy authority contradicts "verifier can't move assets". Its safety patterns are reused above. |
| `BlendManager.sol`, `P2PDesk.sol` | **Not carried over** | Unrelated product surface (basket NFTs, OTC). |
| `IAllocator`, `IStockToken`, solady | **Dropped** | Unused. |

The Wield tree stays intact in `refrance/` (git-ignored at root) for provenance; its MIT notice is preserved in `LICENSE`.

## 5. New STOCKBACK components

| Layer | Component |
|---|---|
| Claim model | `src/PurchaseClaim.sol`: struct, EIP-712 typehash, nullifier derivation, `ClaimStatus` codes |
| Proof | `ReceiptCommitmentRegistry` (commitment, nullifier, orchestration, pause) |
| Proof | `IReceiptVerifier` → `ECDSAAttestationVerifier` (Solidity) and `stylus/receipt-prover` (Ed25519, Rust) |
| Eligibility | `EligibilityPolicy` + optional `IJurisdictionPolicy` gate |
| Reward | `RewardPolicy` (fixed-point, per-claim/daily-user/daily-brand caps) |
| Ownership | `BrandVaultFactory`, `BrandVault` (ERC-4626), `RewardPool` (sponsor-funded budget) |
| USDG | `USDGRewardAdapter` (optional USDG → brand-asset budget funding) |
| Demo | `MockBrandAsset` (refuses mainnet), `script/DeployStockback.s.sol`, `tools/attester.mjs` |
| Evidence | `benchmarks/` Solidity-vs-Stylus Ed25519 harness |

## 6. Risks identified up front

1. **Stylus advantage is workload-dependent.** keccak/ecrecover are already native in the EVM, so a keccak+ECDSA verifier would show no Stylus win. The Stylus module therefore targets Ed25519 (no EVM precompile). The benchmark is reported as measured, with the ECDSA baseline for context.
2. **On-chain Stylus benchmarking needs a Stylus node** (Nitro devnode via Docker, or a funded testnet key). Docker's daemon was inactive during the audit, so no key or node was available.
3. **Attestation authenticity is off-chain.** UPI/GST/email data cannot be verified on-chain here; the attester is a trusted signer. Demo attester = local script with a demo key.
4. **Admin key risk**: owner can swap verifier / policies. Bounded by per-claim, daily and budget caps; vault shares are never admin-accessible.
5. **Sybil**: nullifiers stop receipt replay, not multi-wallet farming; only caps + optional jurisdiction/KYC gate.

## 7. Migration sequence

1. Root Foundry project with Wield's pinned toolchain + CI.
2. Claim model → registry → verifier → tests.
3. Eligibility + reward policies → tests.
4. Factory + vault + pool → integration/security/invariant tests.
5. USDG adapter (reusing Wield oracle/slippage logic) → tests.
6. Stylus Ed25519 verifier → `cargo stylus check` against Robinhood testnet.
7. Benchmark harness (Solidity baseline measured locally; on-chain script for both).
8. Deploy script with chain guards → local anvil run.
9. Docs, README, final validation.
