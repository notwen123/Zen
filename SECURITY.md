# Security

**Status: hackathon build. Not audited. Monad testnet, mock assets only.** Do not deploy with real assets or real user funds.

Report issues privately through a GitHub security advisory on this repository, ideally with a Foundry test that reproduces the issue.

## Security model in one paragraph

The **purchase attester** vouches that a purchase happened; the **ECDSA verifier** only checks that an allowlisted attester signed exactly this claim. The **registry** enforces replay protection (one nullifier per receipt), claimant binding and EIP-712 domain separation, and is the only contract that can consume reward caps or spend budget. The **RewardPool** can only escrow what sponsors deposited. Every reward becomes a **ConditionalClaim** whose equity sits in escrow until the return window closes. Only the **VoidOracle** can void a claim, and only with an allowlisted **refund attester**'s signature over a never-used refund reference, before unlock. After unlock, **anyone** can settle and the equity goes to the current holder. The **InstantExitPool** buys locked claims with idle LP assets at an on-chain price and books the outcome at settle or void. Brand vaults have no admin. A compromise of an attester or the owner is bounded by caps, budgets and on-chain parameter bounds.

## Lifecycle invariants

| Property | How it is enforced | Test(s) |
|---|---|---|
| Escrowed equity == sum of Locked claim amounts, fully backed | `escrowed[token]` in storage, updated on mint / void / settle; mint checks the balance covers it | `Invariant.invariant_escrowEqualsLockedClaims` |
| Funded equity is conserved | budget + escrow + settled payouts == funded; voids return escrow to budget | `Invariant.invariant_conservation`, `ConditionalLifecycle.test_claim_void_returnsEscrowToSponsorBudget` |
| Only the pool mints, only the oracle voids | `msg.sender` checks; one-time `wire` | `test_onlyOracle_voids_onlyPool_mints`, `test_wire_isOneTime_andConfigBounded` |
| No void after unlock; no settle before unlock | `WindowClosed` / `StillLocked` | `test_voidAfterUnlock_rejected`, `test_settleBeforeUnlock_rejected_andResolvedIsFrozen` |
| A refund can't be replayed or reused for another claim | `refundUsed[refundRef]`; claim must still be Locked | `test_replayedVoid_rejected` |
| Only allowlisted refund attesters, fresh deadline | EIP-712 + `isAttester` + deadline | `test_void_requiresAllowlistedAttester_andFreshDeadline` |
| Resolved claims can't move | `_update` reverts unless Locked | `test_settleBeforeUnlock_rejected_andResolvedIsFrozen` |
| A holder contract can't block settlement | gas-capped `try/catch` callback; permissionless `reconcile` | `test_reconcile_isIdempotent` |
| Exit price never exceeds face value; monotonic in risk and time | `priceFor` in bps with `Math.mulDiv`, factors capped at 100% | `testFuzz_price_neverExceedsAmount`, `testFuzz_price_monotonicInRisk`, `testFuzz_price_monotonicInTime` |
| Seller protection | `minOut`, only the holder can sell, no sale after unlock | `test_slippage_minOut`, `test_onlyHolder_canSell`, `test_cannotSellAfterUnlock_orResolved` |
| Adverse-selection defenses | `minHoldSeconds`, wallet risk multiplier from on-chain void ratio | `test_minHold_enforced`, `test_walletRisk_raisesDiscount_afterVoid` |
| LP accounting | `totalAssets = idle + book cost`; gains at settle, losses at void; withdrawals ≤ idle; `_decimalsOffset = 6` | `test_lpShares_reflectGainsAndLosses`, `test_withdrawals_limitedToIdle`, `Invariant.invariant_exitPoolBooksHeldClaims` |
| Liquidity | sale reverts if the price exceeds idle assets | `test_insufficientLiquidity` |

## Passkey accounts and key separation (Mera)

The web app has no wallet extension, seed phrase or custody backend. Sign-in creates or reuses a passkey; Mera (`@category-labs/mera`) returns the passkey's 32-byte **WebAuthn PRF output**, which is never stored. Two independent keys are derived from it in the browser (`web/lib/account.tsx`):

| Key | Derivation | Used for | Never used for |
|---|---|---|---|
| Signing key | BIP-39 entropy → seed → BIP-44 `m/44'/60'/0'/0/0` (Mera's documented path) → secp256k1 signing session → viem account | every transaction: claim, cash out, settle, LP deposit/withdraw, refund submit | encryption |
| Receipt Locker key | HKDF-SHA256(PRF output, salt `zen/passkey-prf/v1`, info **`zen-receipt-locker-v1`**) → AES-256-GCM, **non-extractable** CryptoKey | encrypting raw receipt payloads and claim proofs in IndexedDB | signing |

- **Domain separation.** The two derivations use different constructions and the locker key carries its own HKDF info string, so neither key reveals or equals the other; a bug or leak in one use can't be turned into the other. The PRF output buffer and the raw signing key are zeroed after derivation; the signing session is ended on sign-out and after 30 minutes idle (`session.end()` zeroes it).
- **Locker format.** Each entry is AES-GCM with a fresh 96-bit IV and the entry id and kind bound as additional authenticated data, so ciphertexts can't be swapped between entries. Storage holds ciphertext only (verified in the browser test). Backups export ciphertext; importing on a new device decrypts only after signing in with the **same** passkey.
- **Trade-off (held session).** The signing key lives in page memory while signed in, as in Mera's "hold the session" mode, because the product has several transactions per flow. Any script running on the page could sign while the session is live: keep the CSP strict and dependencies minimal. Per-transaction prompting is the stricter alternative.
- **PRF availability.** Providers without PRF get `PRF_UNAVAILABLE` and a message naming Google Password Manager (on desktop Chrome only passkeys saved to GPM return PRF), iCloud Keychain and 1Password.
- **Testnet faucet.** `/api/faucet` sends 0.12 MON from a server-held key (`FAUCET_PRIVATE_KEY`, never sent to the browser; covered by the secrets scan), refuses any chain but 10143, rate-limits per IP and per address, and skips funded accounts.

## Purchase path (unchanged trust model)

| Risk | Mitigation | Test(s) |
|---|---|---|
| Reentrancy | `nonReentrant` on `submitClaim`, `voidClaim`, `settle`, `sellClaim`, AUSD funding; nullifier burned before external calls | `Security.test_reentrancyThroughAssetHook_blocked` |
| Signature replay across chains / deployments | EIP-712 domain = name, version, chainId, contract | `Security.test_crossChainReplay_rejected`, `test_crossDeploymentReplay_rejected` |
| Malleable signatures | OZ `ECDSA` rejects high-s | `Security.test_highS_malleableSignature_rejected` |
| Receipt replay | `nullifier = keccak(tag, merchantId, receiptHash)`, independent of claimant, amount and deadline | `ReceiptCommitmentRegistry.*`, `Invariant.invariant_noReplay` |
| Front-running a claim | `claimant` is signed and must be `msg.sender` | `test_wrongClaimant_rejected` |
| Caps and budget | per-claim cap clips; daily user and brand caps reject; budget tracked in storage | `RewardPolicy.*`, `RewardPool.*`, `Invariant.invariant_dailyCaps` |
| Compromised verifier | damage bounded by caps and budget; existing claims untouched | `Security.test_compromisedVerifier_boundedByCapsAndBudget` |
| Oracle / slippage on AUSD funding | freshness and positivity checks, oracle-derived `minOut`, 10% hard ceiling (Wield pattern) | `AUSDRewardAdapter.*` |
| Mock assets reaching production | every mock reverts on Monad mainnet (143) and Ethereum (1); the deploy script runs only on 31337 / 10143 / 143 | `Security.test_mocks_refuseProductionChains` |
| PII on-chain | hashes, amount, currency and timestamps only (see `docs/PRIVACY.md`) | `Security.test_onChainClaimRecord_isHashOnly` |

`forge test` with Foundry 1.8.5 and `network = "monad"`: **96 tests + 6 invariants (128 runs × 64 calls), all passing**, including 3 pricing fuzz tests at 1,000 runs.

## Known, accepted risks

1. **Demo admin.** One owner key sets return windows, category refund probabilities, min hold, pricing parameters and attester allowlists, and can withdraw unallocated sponsor budget. Every parameter is bounded on-chain (window ≤ 90 days, pRefund ≤ 90%, wallet multiplier ≤ 3×, fee ≤ 10%, time value ≤ 50%/yr, min hold ≤ 30 days), but production needs a timelocked multisig.
2. **Attester trust.** A compromised purchase attester can mint claims up to the caps and budget. A compromised refund attester can void Locked claims, which hurts holders and LPs (the sponsor gets the escrow back). Mitigations to build: k-of-n attesters, merchant P256 signatures verified on-chain with Monad's P256 precompile (EIP-7951), rate limits per merchant.
3. **Refund probabilities are illustrative.** If real refund rates exceed `pRefund`, LPs lose money. That is the risk the pool exists to price.
4. **Wallet history is per address.** A refunder can start from a fresh wallet. The multiplier raises the cost of repeat refunds from one wallet; it is not Sybil resistance. Min hold and attester-side identity checks are the other layers.
5. **The demo merchant is simulated and its POS is public**, so anyone can mint demo receipts. Merchant-signed receipts demonstrate the mechanism, not fraud resistance.
6. **Best-effort resolution callback.** If the gas-capped callback ever failed, the pool would double count a resolved claim until someone calls `reconcile(id)`.
7. **Public RPC limits.** Monad's public RPC caps `eth_getLogs` at 100 blocks; the app reads state by claim-id enumeration, which grows linearly with the number of claims. An indexer is needed beyond demo scale.
8. **In-memory API rate limits** are per server instance.

## Finding in the upstream Wield code (informational)

Wield's `ISwapRouter` used the original Uniswap V3 `SwapRouter` struct with `deadline` (selector `0x414bf389`). Routers deployed as SwapRouter02 only expose `0x04e45aaf`, so swaps through the old layout revert. Zen's adapter uses the SwapRouter02 layout (`AUSDRewardAdapter.test_routerSelector_isSwapRouter02`).

## Patterns adapted from Wield (MIT)

Oracle freshness and positivity checks, oracle-derived `minOut` with a hard slippage ceiling, pause-new-actions with exits always available, chain-id deployment guards and OZ ERC-4626 virtual-share inflation protection.
