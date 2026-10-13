# Privacy

| Data | Where it lives | Notes |
|---|---|---|
| Raw receipt (image, line items, UPI VPA, phone, email, name, address) | **Off-chain only** (user device → attester over TLS) | Never in calldata, storage or events. |
| Normalised claim before hashing (merchant name, receipt/UPI reference) | **Off-chain** (attester) | Hashed before anything is signed. |
| `merchantId = keccak256(merchant identifier)` | On-chain (calldata, event) | Identifies the store for analytics. Merchant identifiers are business data, not personal data. |
| `receiptHash = keccak256(abi.encode(keccak256(ATTESTER_SALT), receiptRef))` | On-chain | Salted with an attester-held secret, because receipt and UPI references are short and would be brute-forceable if hashed unsalted. |
| Commitment / claim ID (EIP-712 struct hash) | On-chain (event) | Hash only. |
| Nullifier | On-chain (storage, event) | `keccak256(tag, merchantId, receiptHash)`. |
| Amount, currency, purchase time, brand | On-chain (calldata, event) | Needed to evaluate reward rules publicly. See "What is still revealed". |
| Claimant wallet address | On-chain | Receives the shares. |
| Attestation signature | On-chain (calldata) | Proves an allowlisted attester signed; contains no PII. |

## What is still revealed

Anyone can see that wallet **W** made a purchase of **₹X** at merchant hash **M**, brand **B**, at time **T**. A wallet that claims regularly builds a visible spending history. This is the main privacy cost of the MVP. Users should claim from a wallet not linked to their identity.

## Demo vs production

| | Demo (this repo) | Production direction |
|---|---|---|
| Attester | `tools/attester.mjs` with a local key and a demo salt | Merchant or payment-processor attester with an HSM-held key and a secret salt |
| Amount / time | Exact values on-chain | Bucketed amounts or a ZK range proof ("amount in [a, b]") so exact spend is hidden |
| Merchant | Hash of name | Hash of a registered merchant ID |
| Wallet linkage | User's choice | Account abstraction / fresh claim wallets |

No ZK proof is used in this MVP. Authenticity comes from the attester signature. The cryptography proves only that the on-chain claim is exactly what the attester signed.
