// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Attestation verifier. Pure yes/no answer: it holds no funds and has no
///         authority over rewards, vaults or policies.
interface IReceiptVerifier {
    /// @param digest EIP-712 digest of the PurchaseClaim, domain-bound to the registry.
    /// @param attestation Verifier-specific proof (e.g. 65-byte ECDSA sig, or Ed25519 pubkey||sig).
    function verify(bytes32 digest, bytes calldata attestation) external view returns (bool);
}
