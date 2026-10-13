// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PurchaseClaim, ClaimStatus, ClaimLib} from "./PurchaseClaim.sol";
import {IReceiptVerifier} from "./interfaces/IReceiptVerifier.sol";
import {IEligibilityPolicy} from "./interfaces/IEligibilityPolicy.sol";
import {IRewardPolicy} from "./interfaces/IRewardPolicy.sol";
import {IRewardPool} from "./interfaces/IRewardPool.sol";

/// @title ReceiptCommitmentRegistry
/// @notice Entry point of STOCKBACK: attested purchase claim -> commitment + nullifier ->
///         verification -> eligibility -> reward -> brand-vault shares, in one transaction.
/// @dev Only this contract may consume reward caps or allocate pool budget. The verifier
///      only answers yes/no. Stored data is hashes only - no PII.
contract ReceiptCommitmentRegistry is EIP712, Ownable, ReentrancyGuard {
    using ClaimLib for PurchaseClaim;

    IReceiptVerifier public verifier;
    IEligibilityPolicy public eligibility;
    IRewardPolicy public rewardPolicy;
    IRewardPool public immutable pool;
    bool public paused;

    /// @notice nullifier => claimId that consumed it (zero if unused).
    mapping(bytes32 => bytes32) public claimOfNullifier;

    error ClaimRejected(ClaimStatus status);
    error ClaimsPaused();
    error ZeroAddress();

    event PurchaseCommitted(
        bytes32 indexed claimId,
        bytes32 indexed nullifier,
        address indexed claimant,
        bytes32 brandId,
        bytes32 merchantId,
        uint128 amount,
        bytes3 currency
    );
    event RewardAllocated(
        bytes32 indexed claimId, bytes32 indexed brandId, address indexed claimant, uint256 assets, uint256 shares
    );
    event VerifierUpdated(address indexed verifier);
    event EligibilityPolicyUpdated(address indexed policy);
    event RewardPolicyUpdated(address indexed policy);
    event Paused(bool paused);

    constructor(
        address owner_,
        IReceiptVerifier verifier_,
        IEligibilityPolicy eligibility_,
        IRewardPolicy rewardPolicy_,
        IRewardPool pool_
    ) EIP712("STOCKBACK", "1") Ownable(owner_) {
        if (address(pool_) == address(0)) revert ZeroAddress();
        pool = pool_;
        _setVerifier(verifier_);
        _setEligibility(eligibility_);
        _setRewardPolicy(rewardPolicy_);
    }

    // ---------------------------------------------------------------- admin

    function setVerifier(IReceiptVerifier v) external onlyOwner {
        _setVerifier(v);
    }

    function setEligibilityPolicy(IEligibilityPolicy p) external onlyOwner {
        _setEligibility(p);
    }

    function setRewardPolicy(IRewardPolicy p) external onlyOwner {
        _setRewardPolicy(p);
    }

    /// @notice Pause blocks new claims only. Vault redemptions are never pausable.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    // ---------------------------------------------------------------- views

    /// @notice Digest the attester signs (EIP-712, bound to chain id + this contract).
    function claimDigest(PurchaseClaim calldata c) public view returns (bytes32) {
        return _hashTypedDataV4(c.hash());
    }

    function claimId(PurchaseClaim calldata c) external pure returns (bytes32) {
        return c.hash();
    }

    function nullifierOf(PurchaseClaim calldata c) external pure returns (bytes32) {
        return c.nullifier();
    }

    /// @notice Dry-run for frontends: every check `submitClaim` performs, as a status code.
    ///         The claimant check is skipped because eth_call senders vary.
    function previewClaim(PurchaseClaim calldata c, bytes calldata attestation)
        external
        view
        returns (ClaimStatus status, uint256 reward)
    {
        status = _check(c, attestation);
        if (status != ClaimStatus.Ok) return (status, 0);
        return _quote(c);
    }

    // ---------------------------------------------------------------- claim

    function submitClaim(PurchaseClaim calldata c, bytes calldata attestation)
        external
        nonReentrant
        returns (bytes32 id, uint256 shares)
    {
        if (paused) revert ClaimsPaused();
        if (c.claimant != msg.sender) revert ClaimRejected(ClaimStatus.WrongClaimant);

        ClaimStatus status = _check(c, attestation);
        if (status != ClaimStatus.Ok) revert ClaimRejected(status);

        uint256 reward;
        (status, reward) = _quote(c);
        if (status != ClaimStatus.Ok) revert ClaimRejected(status);

        // Effects before interactions: burn the nullifier first.
        id = c.hash();
        bytes32 n = c.nullifier();
        claimOfNullifier[n] = id;
        emit PurchaseCommitted(id, n, c.claimant, c.brandId, c.merchantId, c.amount, c.currency);

        // Policy records cap usage (reverts if caps moved), pool deposits into the brand vault.
        reward = rewardPolicy.consume(c);
        shares = pool.allocate(c.brandId, c.claimant, reward);
        emit RewardAllocated(id, c.brandId, c.claimant, reward, shares);
    }

    // ---------------------------------------------------------------- internal

    function _check(PurchaseClaim calldata c, bytes calldata attestation) internal view returns (ClaimStatus) {
        if (
            c.claimant == address(0) || c.brandId == 0 || c.merchantId == 0 || c.receiptHash == 0 || c.amount == 0
                || c.currency == 0
        ) return ClaimStatus.Malformed;
        if (block.timestamp > c.deadline) return ClaimStatus.Expired;
        if (claimOfNullifier[c.nullifier()] != 0) return ClaimStatus.NullifierUsed;
        if (!verifier.verify(claimDigest(c), attestation)) return ClaimStatus.BadAttestation;
        return eligibility.check(c);
    }

    function _quote(PurchaseClaim calldata c) internal view returns (ClaimStatus status, uint256 reward) {
        (status, reward) = rewardPolicy.quote(c);
        if (status == ClaimStatus.Ok && pool.budgetOf(c.brandId) < reward) status = ClaimStatus.BudgetExhausted;
    }

    function _setVerifier(IReceiptVerifier v) internal {
        if (address(v) == address(0)) revert ZeroAddress();
        verifier = v;
        emit VerifierUpdated(address(v));
    }

    function _setEligibility(IEligibilityPolicy p) internal {
        if (address(p) == address(0)) revert ZeroAddress();
        eligibility = p;
        emit EligibilityPolicyUpdated(address(p));
    }

    function _setRewardPolicy(IRewardPolicy p) internal {
        if (address(p) == address(0)) revert ZeroAddress();
        rewardPolicy = p;
        emit RewardPolicyUpdated(address(p));
    }
}
