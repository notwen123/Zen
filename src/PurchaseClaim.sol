// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Canonical, PII-free purchase claim. Raw receipts never reach the chain:
///         identifiers are hashed off-chain by the attester before signing.
struct PurchaseClaim {
    address claimant; // wallet that receives the reward; must be msg.sender
    bytes32 brandId; // e.g. bytes32("NIKE"); selects vault + policies
    bytes32 merchantId; // keccak256 of the merchant identifier (store / GSTIN)
    bytes32 receiptHash; // keccak256 of the receipt / payment reference + attester salt
    uint128 amount; // purchase value in minor units (paise, cents)
    bytes3 currency; // ISO-4217, e.g. "INR"
    uint64 purchasedAt; // unix seconds
    uint64 deadline; // attestation expiry, unix seconds
}

/// @notice One code for every reason a claim can be accepted or rejected.
///         Shared by `previewClaim` (view) and `submitClaim` (reverts with it).
enum ClaimStatus {
    Ok,
    Malformed,
    WrongClaimant,
    Expired,
    NullifierUsed,
    BadAttestation,
    BrandInactive,
    CurrencyMismatch,
    AmountOutOfRange,
    PurchaseTooOld,
    PurchaseInFuture,
    JurisdictionBlocked,
    ZeroReward,
    UserDailyCapReached,
    BrandDailyCapReached,
    BudgetExhausted
}

library ClaimLib {
    bytes32 internal constant CLAIM_TYPEHASH = keccak256(
        "PurchaseClaim(address claimant,bytes32 brandId,bytes32 merchantId,bytes32 receiptHash,uint128 amount,bytes3 currency,uint64 purchasedAt,uint64 deadline)"
    );

    bytes32 internal constant NULLIFIER_TAG = keccak256("STOCKBACK_NULLIFIER_V1");

    /// @notice EIP-712 struct hash. Used as the claim ID / commitment.
    function hash(PurchaseClaim calldata c) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                c.claimant,
                c.brandId,
                c.merchantId,
                c.receiptHash,
                c.amount,
                c.currency,
                c.purchasedAt,
                c.deadline
            )
        );
    }

    /// @notice One nullifier per (merchant, receipt). Deliberately excludes claimant,
    ///         amount and deadline so the same receipt cannot be re-claimed by
    ///         changing any of them.
    function nullifier(PurchaseClaim calldata c) internal pure returns (bytes32) {
        return keccak256(abi.encode(NULLIFIER_TAG, c.merchantId, c.receiptHash));
    }
}
