// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSAAttestationVerifier} from "stockback/ECDSAAttestationVerifier.sol";

/// @notice Context baseline: the production Solidity verifier (secp256k1 via the ecrecover
///         precompile) with the same batch entry point. Different algorithm from Ed25519,
///         reported separately - not an apples-to-apples Stylus comparison.
contract ECDSABatchVerifier is ECDSAAttestationVerifier {
    constructor(address owner_) ECDSAAttestationVerifier(owner_) {}

    function verifyBatch(bytes32[] calldata digests, bytes[] calldata attestations) external view returns (bool) {
        if (digests.length != attestations.length) return false;
        for (uint256 i; i < digests.length; i++) {
            if (!verify(digests[i], attestations[i])) return false;
        }
        return true;
    }
}
