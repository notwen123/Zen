// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PurchaseClaim, ClaimStatus} from "./PurchaseClaim.sol";
import {IEligibilityPolicy} from "./interfaces/IEligibilityPolicy.sol";
import {IJurisdictionPolicy} from "./interfaces/IJurisdictionPolicy.sol";

/// @title EligibilityPolicy
/// @notice Stateless rules deciding whether a verified claim may be rewarded:
///         brand active, currency, amount bounds, purchase age, and an optional
///         jurisdiction/KYC adapter. Geography is never hardcoded here.
contract EligibilityPolicy is IEligibilityPolicy, Ownable {
    struct BrandRules {
        bool active;
        bytes3 currency;
        uint128 minAmount;
        uint128 maxAmount;
    }

    mapping(bytes32 => BrandRules) public rules;

    /// @notice Oldest purchase that can still be claimed.
    uint64 public maxPurchaseAge = 30 days;

    /// @notice Optional. Zero = no jurisdiction gate (testnet demo only; see docs/COMPLIANCE.md).
    IJurisdictionPolicy public jurisdiction;

    error BadRules();

    event BrandRulesSet(bytes32 indexed brandId, BrandRules rules);
    event MaxPurchaseAgeSet(uint64 age);
    event JurisdictionPolicySet(address indexed policy);

    constructor(address owner_) Ownable(owner_) {}

    function setBrandRules(bytes32 brandId, BrandRules calldata r) external onlyOwner {
        if (brandId == 0 || r.currency == 0 || r.minAmount == 0 || r.maxAmount < r.minAmount) revert BadRules();
        rules[brandId] = r;
        emit BrandRulesSet(brandId, r);
    }

    function setMaxPurchaseAge(uint64 age) external onlyOwner {
        if (age == 0) revert BadRules();
        maxPurchaseAge = age;
        emit MaxPurchaseAgeSet(age);
    }

    function setJurisdictionPolicy(IJurisdictionPolicy p) external onlyOwner {
        jurisdiction = p;
        emit JurisdictionPolicySet(address(p));
    }

    function check(PurchaseClaim calldata c) external view returns (ClaimStatus) {
        BrandRules memory r = rules[c.brandId];
        if (!r.active) return ClaimStatus.BrandInactive;
        if (c.currency != r.currency) return ClaimStatus.CurrencyMismatch;
        if (c.amount < r.minAmount || c.amount > r.maxAmount) return ClaimStatus.AmountOutOfRange;
        if (c.purchasedAt > block.timestamp) return ClaimStatus.PurchaseInFuture;
        if (block.timestamp - c.purchasedAt > maxPurchaseAge) return ClaimStatus.PurchaseTooOld;
        if (address(jurisdiction) != address(0) && !jurisdiction.isEligible(c.claimant, c.brandId)) {
            return ClaimStatus.JurisdictionBlocked;
        }
        return ClaimStatus.Ok;
    }
}
