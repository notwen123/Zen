// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./vendor/chengwenxi-ed25519/Ed25519.sol";

/// @notice Solidity twin of stylus/receipt-prover: identical ABI and checks
///         (allowlisted pubkey, 96-byte attestation, Ed25519 over the 32-byte digest),
///         so both can be benchmarked with byte-identical calldata.
contract Ed25519Verifier {
    address public owner;
    mapping(bytes32 => bool) public isAttester;

    constructor(address owner_) public {
        owner = owner_;
    }

    function setAttester(bytes32 pubkey, bool allowed) external {
        require(msg.sender == owner, "not owner");
        isAttester[pubkey] = allowed;
    }

    function verify(bytes32 digest, bytes memory attestation) public view returns (bool) {
        if (attestation.length != 96) return false;
        bytes32 k;
        bytes32 r;
        bytes32 s;
        assembly {
            k := mload(add(attestation, 32))
            r := mload(add(attestation, 64))
            s := mload(add(attestation, 96))
        }
        if (!isAttester[k]) return false;
        return Ed25519.verify(k, r, s, abi.encodePacked(digest));
    }

    /// @dev Best-case Solidity: the library allocates memory it never frees, so a naive loop
    ///      pays quadratic memory expansion. Rewinding the free-memory pointer after each
    ///      verification (safe: only a bool survives) keeps the batch linear.
    function verifyBatch(bytes32[] calldata digests, bytes[] calldata attestations) external view returns (bool) {
        if (digests.length != attestations.length) return false;
        for (uint256 i = 0; i < digests.length; i++) {
            uint256 fmp;
            assembly {
                fmp := mload(0x40)
            }
            bool ok = verify(digests[i], attestations[i]);
            assembly {
                mstore(0x40, fmp)
            }
            if (!ok) return false;
        }
        return true;
    }

    /// @dev Naive loop, kept only to show the quadratic memory cost in the benchmark.
    function verifyBatchNaive(bytes32[] calldata digests, bytes[] calldata attestations)
        external
        view
        returns (bool)
    {
        if (digests.length != attestations.length) return false;
        for (uint256 i = 0; i < digests.length; i++) {
            if (!verify(digests[i], attestations[i])) return false;
        }
        return true;
    }
}
