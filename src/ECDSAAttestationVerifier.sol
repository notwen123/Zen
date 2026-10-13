// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IReceiptVerifier} from "./interfaces/IReceiptVerifier.sol";

/// @title ECDSAAttestationVerifier
/// @notice Accepts a 65-byte secp256k1 signature over the claim digest from an allowlisted
///         attester. The attester is the source of authenticity (merchant, payment
///         processor, or - in the demo - `tools/attester.mjs`). This contract only checks
///         that an allowlisted attester signed exactly this claim.
contract ECDSAAttestationVerifier is IReceiptVerifier, Ownable {
    mapping(address => bool) public isAttester;

    event AttesterSet(address indexed attester, bool allowed);

    constructor(address owner_) Ownable(owner_) {}

    function setAttester(address attester, bool allowed) external onlyOwner {
        isAttester[attester] = allowed;
        emit AttesterSet(attester, allowed);
    }

    function verify(bytes32 digest, bytes calldata attestation) public view returns (bool) {
        if (attestation.length != 65) return false;
        // tryRecover rejects malleable (high-s) signatures and never reverts.
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, attestation);
        return err == ECDSA.RecoverError.NoError && isAttester[signer];
    }
}
