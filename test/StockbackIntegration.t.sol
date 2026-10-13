// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim, ClaimStatus} from "../src/PurchaseClaim.sol";
import {BrandVault} from "../src/BrandVault.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";

/// @notice End-to-end: two brands, two users, preview -> submit -> portfolio -> exit.
contract StockbackIntegrationTest is StockbackFixture {
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

        _submit(nike);
        _submit(coffee);
        _submit(_claim(bob, 10_000_00));

        // Portfolio: exposure per brand the user actually buys from.
        assertEq(nikeVault.convertToAssets(nikeVault.balanceOf(alice)), 15e18);
        assertEq(sbuxVault.convertToAssets(sbuxVault.balanceOf(alice)), 3.375e18);
        assertEq(nikeVault.convertToAssets(nikeVault.balanceOf(bob)), 75e18);
        assertEq(sbuxVault.balanceOf(bob), 0);

        // Accounting: vault assets == rewards issued; pool budget reduced by the same.
        assertEq(nikeVault.totalAssets(), 90e18);
        assertEq(pool.budgetOf(NIKE), BUDGET - 90e18);
        assertEq(pool.budgetOf(SBUX), BUDGET - 3.375e18);

        // Exit: shares redeem 1:1 for the underlying mock asset.
        uint256 aliceShares = nikeVault.balanceOf(alice);
        vm.prank(alice);
        nikeVault.redeem(aliceShares, alice, alice);
        assertEq(mNKE.balanceOf(alice), 15e18);
        assertEq(nikeVault.convertToAssets(nikeVault.balanceOf(bob)), 75e18, "bob unaffected");
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
        assertEq(nikeVault.convertToAssets(nikeVault.balanceOf(alice)), 5 * DAILY_USER_CAP);
    }
}
