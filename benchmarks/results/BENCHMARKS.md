# Benchmarks: Ed25519 attestation verification, Solidity vs Stylus

> **Status (2026-09-28): both sides measured on Robinhood Chain testnet (46630).** Raw output: [`onchain-46630.md`](onchain-46630.md).

## Workload

`verifyBatch(bytes32[] digests, bytes[] attestations) → bool`. For each item: attestation length is 96 bytes, the pubkey is allowlisted (one SLOAD), and there is a strict RFC 8032 Ed25519 verification over the 32-byte EIP-712 claim digest. This is the exact check `ReceiptCommitmentRegistry` delegates to its verifier.

Why Ed25519: the EVM has no Ed25519 precompile, so Solidity must run SHA-512 and curve25519 arithmetic in bytecode. We deliberately did **not** benchmark keccak or secp256k1 ECDSA as the "Stylus workload". Those are native EVM opcodes and precompiles, so a Stylus port would show no meaningful advantage there.

Implementations (same ABI, same checks, same inputs):

| Side | Code |
|---|---|
| Stylus | `stylus/receipt-prover` (Rust, `ed25519-dalek` 2.x `verify_strict`, stylus-sdk 0.10.9), 20,344 bytes compressed WASM (`cargo stylus check` against Robinhood testnet) |
| Solidity | `benchmarks/solidity/src/Ed25519Verifier.sol` wrapping the Apache-2.0 library [chengwenxi/Ed25519](https://github.com/chengwenxi/Ed25519) @ `34d8c57` (solc 0.6.12, optimizer 200) |
| Context only | `ECDSABatchVerifier`: the production Solidity secp256k1 verifier. It's a different algorithm, shown only to put the Ed25519 numbers in context. |

Inputs: `benchmarks/fixtures/vectors.json`, 100 distinct digests signed by a fixed Ed25519 key and a fixed secp256k1 key (`benchmarks/gen_vectors.mjs`, Node `crypto` and `cast`). Signatures are cross-checked: Node signs, then both the Rust verifier and the Solidity verifier accept all of them and reject tampered ones.

## Measured: Solidity, local EVM execution gas (`forge test`, 2026-09-28)

Gas is measured with `gasleft()` around the external `verifyBatch` call (execution only; no intrinsic or calldata gas).

| batch | Solidity Ed25519 (gas) | per sig | Ed25519 naive loop (gas) | Solidity ECDSA (gas) | per sig |
|---:|---:|---:|---:|---:|---:|
| 1 | 698,047 | 698,047 | 691,591 | 13,139 | 13,139 |
| 10 | 6,080,386 | 608,038 | 13,541,054 | 51,784 | 5,178 |
| 50 | 30,032,114 | 600,642 | 216,386,650 | 252,504 | 5,050 |
| 100 | 60,111,234 | 601,112 | 814,273,849 | 503,628 | 5,036 |

Observations (from the numbers above, not extrapolated):

- Best-case Solidity Ed25519 costs about **600k gas per signature**. That already includes rewinding the free-memory pointer between signatures.
- Without that rewind (the "naive loop"), the library's memory allocations accumulate and cost grows **quadratically**: 814M gas for 100 signatures.
- Robinhood testnet and Arbitrum Sepolia both report `maxTxGasLimit = 32,000,000` (read from `ArbGasInfo.getGasAccountingParams()` on 2026-09-28). So even best-case Solidity can verify **at most about 53** Ed25519 attestations in one transaction. Batch 100 **cannot run** on those chains.
- With the Solidity Ed25519 verifier plugged into the registry, a full `submitClaim` cost **951,760 gas** on anvil, against **266,395** with the ECDSA verifier.

## Measured: Stylus vs Solidity on Robinhood Chain testnet (2026-09-28)

Both verifiers were deployed on chain 46630 with the same allowlisted pubkey. For each batch size, `verifyBatch` was first called to confirm it returns `true`. Then `eth_estimateGas` was recorded with **byte-identical calldata**, so intrinsic, calldata and L1 components are equal on both sides.

- Stylus `ReceiptProver`: `0x9ae8a390121ba71545e9923b333d60e7e3ccd3bd` (not ArbOS-cached)
- Solidity `Ed25519Verifier`: `0xD5e5CE9708d70aE8727E3cCED08b25b9036F2A37`

| batch | Solidity Ed25519 (gas) | Stylus Ed25519 (gas) | Stylus / Solidity | Solidity ÷ Stylus |
|---:|---:|---:|---:|---:|
| 1 | 736,502 | 140,063 | 0.190 | 5.3× |
| 10 | 6,214,368 | 724,659 | 0.117 | 8.6× |
| 50 | 30,555,405 | 3,327,511 | 0.109 | 9.2× |
| 100 | exceeds 32M tx cap | 6,583,441 | n/a | n/a |

From these numbers:

- **Marginal cost per extra signature**: Solidity about 608,500 gas (batch 1 → 50); Stylus about 65,100 gas (batch 1 → 100).
- Stylus verifies **100 attestations in one transaction** using about 21% of the 32M cap. Solidity cannot fit 100 at all, and batch 50 uses about 95% of the cap.
- The batch-1 ratio is smaller because the fixed per-transaction costs (21k intrinsic, calldata, L1, Stylus program entry) weigh more there.
- Full claim transactions on the same chain: `submitClaim` with the ECDSA verifier cost **278,965 gas**; with the Stylus Ed25519 verifier, **372,294 gas** (tx `0x7fe2a51a…d9c4`). On local anvil, the Solidity Ed25519 verifier path cost **951,760 gas**.
- ECDSA through the ecrecover precompile is still the cheapest option, about 5k gas per signature marginal. Stylus matters when the attestation scheme is one the EVM can't verify natively, such as Ed25519.

## Reproduce

```bash
node benchmarks/gen_vectors.mjs                 # regenerate fixtures (deterministic)
forge test --root benchmarks/solidity -vv       # Solidity correctness + gas table -> results/solidity-local.md
(cd stylus/receipt-prover && cargo test)        # Rust correctness on the same 100 vectors
(cd stylus/receipt-prover && cargo stylus check -e https://rpc.testnet.chain.robinhood.com)
STYLUS=0x... RPC_URL=... PRIVATE_KEY=... benchmarks/run_onchain.sh   # on-chain; omit STYLUS to deploy a new one
```
