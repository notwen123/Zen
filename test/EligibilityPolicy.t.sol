// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim, ClaimStatus} from "../src/PurchaseClaim.sol";
import {EligibilityPolicy} from "../src/EligibilityPolicy.sol";
import {IJurisdictionPolicy} from "../src/interfaces/IJurisdictionPolicy.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Test-only jurisdiction adapter: blocks listed wallets.
contract BlocklistJurisdiction is IJurisdictionPolicy {
    mapping(address => bool) public blocked;

    function setBlocked(address a, bool b) external {
        blocked[a] = b;
    }

    function isEligible(address claimant, bytes32) external view returns (bool) {
        return !blocked[claimant];
    }
}

contract EligibilityPolicyTest is StockbackFixture {
    function _status(PurchaseClaim memory c) internal view returns (ClaimStatus) {
        return eligibility.check(c);
    }

    function test_ok() public {
        assertEq(uint8(_status(_claim(alice, 2_000_00))), uint8(ClaimStatus.Ok));
    }

    function test_unknownBrand_inactive() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        c.brandId = SBUX;
        assertEq(uint8(_status(c)), uint8(ClaimStatus.BrandInactive));
    }

    function test_currencyMismatch() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        c.currency = bytes3("USD");
        assertEq(uint8(_status(c)), uint8(ClaimStatus.CurrencyMismatch));
    }

    function test_amountBounds() public {
        assertEq(uint8(_status(_claim(alice, 100_00 - 1))), uint8(ClaimStatus.AmountOutOfRange));
        assertEq(uint8(_status(_claim(alice, 100_00))), uint8(ClaimStatus.Ok));
        assertEq(uint8(_status(_claim(alice, 500_000_00))), uint8(ClaimStatus.Ok));
        assertEq(uint8(_status(_claim(alice, 500_000_00 + 1))), uint8(ClaimStatus.AmountOutOfRange));
    }

    function test_purchaseAge() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        c.purchasedAt = uint64(block.timestamp + 1);
        assertEq(uint8(_status(c)), uint8(ClaimStatus.PurchaseInFuture));
        c.purchasedAt = uint64(block.timestamp - 30 days);
        assertEq(uint8(_status(c)), uint8(ClaimStatus.Ok));
        c.purchasedAt = uint64(block.timestamp - 30 days - 1);
        assertEq(uint8(_status(c)), uint8(ClaimStatus.PurchaseTooOld));
    }

    function test_jurisdictionAdapter_blocksAndIsEndToEnd() public {
        BlocklistJurisdiction j = new BlocklistJurisdiction();
        j.setBlocked(bob, true);
        vm.prank(owner);
        eligibility.setJurisdictionPolicy(j);

        assertEq(uint8(_status(_claim(alice, 2_000_00))), uint8(ClaimStatus.Ok));
        PurchaseClaim memory c = _claim(bob, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.JurisdictionBlocked);
        vm.prank(bob);
        registry.submitClaim(c, att);
    }

    function test_deactivatedBrand_rejectedEndToEnd() public {
        vm.prank(owner);
        eligibility.setBrandRules(
            NIKE, EligibilityPolicy.BrandRules({active: false, currency: INR, minAmount: 1, maxAmount: 1})
        );
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.BrandInactive);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    function test_badRules_revert() public {
        vm.startPrank(owner);
        vm.expectRevert(EligibilityPolicy.BadRules.selector);
        eligibility.setBrandRules(0, EligibilityPolicy.BrandRules(true, INR, 1, 2));
        vm.expectRevert(EligibilityPolicy.BadRules.selector);
        eligibility.setBrandRules(NIKE, EligibilityPolicy.BrandRules(true, 0, 1, 2));
        vm.expectRevert(EligibilityPolicy.BadRules.selector);
        eligibility.setBrandRules(NIKE, EligibilityPolicy.BrandRules(true, INR, 0, 2));
        vm.expectRevert(EligibilityPolicy.BadRules.selector);
        eligibility.setBrandRules(NIKE, EligibilityPolicy.BrandRules(true, INR, 3, 2));
        vm.expectRevert(EligibilityPolicy.BadRules.selector);
        eligibility.setMaxPurchaseAge(0);
        vm.stopPrank();
    }

    function test_onlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        eligibility.setBrandRules(NIKE, EligibilityPolicy.BrandRules(true, INR, 1, 2));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        eligibility.setMaxPurchaseAge(1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        eligibility.setJurisdictionPolicy(IJurisdictionPolicy(address(0)));
        vm.stopPrank();
    }
}
