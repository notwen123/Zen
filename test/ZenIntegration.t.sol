// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ZenFixture} from "./utils/ZenFixture.sol";
import {PurchaseClaim, ClaimStatus} from "../src/PurchaseClaim.sol";
import {BrandVault} from "../src/BrandVault.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";

/// @notice End-to-end: two brands, two users, preview -> submit -> locked claim -> settle -> vault.
contract ZenIntegrationTest is ZenFixture {
    MockBrandAsset mSBUX;
    BrandVault sbuxVault;

    function setUp() public override {
        super.setUp();
        vm.startPrank(owner);
        mSBUX = new MockBrandAsset("Mock Starbucks Exposure (TEST)", "mSBUX", owner);
        sbuxVault = BrandVault(factory.createVault(SBUX, mSBUX, "STOCKBACK mSBUX Vault", "sbSBUX"));
        _configureBrand(SBUX);
        mSBUX.mint(sponsor, BUDGET);
        vm.stopPrank();
        vm.startPrank(sponsor);
        mSBUX.approve(address(pool), BUDGET);
        pool.fund(SBUX, BUDGET);
        vm.stopPrank();
    }

    function test_purchaseToOwnership_multiBrand() public {
        // Alice buys Nike shoes (Rs 2,000) and Starbucks coffee (Rs 450).
        PurchaseClaim memory nike = _claim(alice, 2_000_00);
        PurchaseClaim memory coffee = _claim(alice, 450_00);
        coffee.brandId = SBUX;
        coffee.merchantId = keccak256("merchant:sbux-bkc");

        // Frontend preview shows reward before the user signs anything.
        (ClaimStatus s, uint256 quoted) = registry.previewClaim(coffee, _sign(attesterPk, coffee));
        assertEq(uint8(s), uint8(ClaimStatus.Ok));
        assertEq(quoted, 3.375e18);

        (, uint256 pNike) = _submit(nike);
        (, uint256 pCoffee) = _submit(coffee);
        (, uint256 pBob) = _submit(_claim(bob, 10_000_00));

        // Every reward is a locked, conditional claim; categories set the unlock time.
        assertEq(_amt(pNike), 15e18);
        assertEq(_amt(pCoffee), 3.375e18);
        assertEq(_amt(pBob), 75e18);
        assertEq(conditional.claimOf(pCoffee).unlockAt, coffee.purchasedAt + 1 days, "food: 1-day window");
        assertEq(conditional.claimOf(pNike).unlockAt, nike.purchasedAt + FASHION_WINDOW, "fashion: 30 days");
        assertEq(conditional.escrowed(address(mNKE)), 90e18);
        assertEq(pool.budgetOf(NIKE), BUDGET - 90e18);
        assertEq(pool.budgetOf(SBUX), BUDGET - 3.375e18);

        // Coffee unlocks first; settling is permissionless and pays the holder.
        vm.warp(block.timestamp + 1 days);
        vm.prank(bob);
        conditional.settle(pCoffee);
        assertEq(mSBUX.balanceOf(alice), 3.375e18);

        // After the fashion window, settled equity can go into the admin-less brand vault.
        vm.warp(block.timestamp + FASHION_WINDOW);
        conditional.settle(pNike);
        conditional.settle(pBob);
        assertEq(conditional.escrowed(address(mNKE)), 0);
        vm.startPrank(alice);
        mNKE.approve(address(nikeVault), 15e18);
        uint256 shares = nikeVault.deposit(15e18, alice);
        assertEq(nikeVault.redeem(shares, alice, alice), 15e18);
        vm.stopPrank();
        assertEq(mNKE.balanceOf(bob), 75e18, "bob unaffected");
    }

    function test_sameReceiptCannotCrossBrands() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        _submit(c);
        PurchaseClaim memory c2 = _copy(c);
        c2.brandId = SBUX; // same merchant + receipt, different brand
        bytes memory att = _sign(attesterPk, c2);
        _expectRejected(ClaimStatus.NullifierUsed);
        vm.prank(alice);
        registry.submitClaim(c2, att);
    }

    function test_rewardsAccrueAcrossDays_withinCaps() public {
        for (uint256 d; d < 5; d++) {
            for (uint256 i; i < 3; i++) {
                _submit(_claim(alice, 100_000_00));
            }
            vm.warp(block.timestamp + 1 days);
        }
        assertEq(conditional.balanceOf(alice), 15);
        assertEq(conditional.escrowed(address(mNKE)), 5 * DAILY_USER_CAP);
    }
}
