// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IConditionalClaim} from "./interfaces/IConditionalClaim.sol";

/// @title VoidOracle
/// @notice Turns an authorized refund proof into a void. A refund is authorized when an allowlisted
///         attester signs an EIP-712 `RefundAttestation`. The attester is where merchant-signed refund
///         receipts (and, off-chain, DKIM-verified refund emails) are checked; the chain only sees the
///         attester's signature over (claimId, refundRef, deadline).
/// @dev `refundRef` is a nullifier for the refund itself (hash of the merchant's refund id), so one
///      refund can never void two claims or be replayed. The before-unlock rule is enforced by
///      ConditionalClaim. Anyone may submit a valid attestation (merchant, attester or a keeper).
contract VoidOracle is EIP712, Ownable {
    bytes32 public constant REFUND_TYPEHASH =
        keccak256("RefundAttestation(uint256 claimId,bytes32 refundRef,uint64 deadline)");

    IConditionalClaim public immutable claims;
    mapping(address => bool) public isAttester;
    mapping(bytes32 => bool) public refundUsed;

    error ZeroAddress();
    error Expired();
    error RefundReplayed(bytes32 refundRef);
    error NotAttester(address signer);

    event AttesterSet(address indexed attester, bool allowed);
    event RefundAccepted(uint256 indexed claimId, bytes32 indexed refundRef, address indexed attester);

    constructor(address owner_, IConditionalClaim claims_) EIP712("Zen VoidOracle", "1") Ownable(owner_) {
        if (address(claims_) == address(0)) revert ZeroAddress();
        claims = claims_;
    }

    /// @notice Demo admin: allowlist refund attesters. Production: timelock/governance.
    function setAttester(address a, bool allowed) external onlyOwner {
        if (a == address(0)) revert ZeroAddress();
        isAttester[a] = allowed;
        emit AttesterSet(a, allowed);
    }

    function refundDigest(uint256 claimId, bytes32 refundRef, uint64 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(REFUND_TYPEHASH, claimId, refundRef, deadline)));
    }

    function voidWithAttestation(uint256 claimId, bytes32 refundRef, uint64 deadline, bytes calldata sig) external {
        if (block.timestamp > deadline) revert Expired();
        if (refundUsed[refundRef]) revert RefundReplayed(refundRef);
        address signer = ECDSA.recover(refundDigest(claimId, refundRef, deadline), sig);
        if (!isAttester[signer]) revert NotAttester(signer);
        refundUsed[refundRef] = true;
        emit RefundAccepted(claimId, refundRef, signer);
        claims.voidClaim(claimId); // reverts if not Locked or the return window has closed
    }
}
