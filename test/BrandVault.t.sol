// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";

contract BrandVaultTest is StockbackFixture {
    function test_metadata() public view {
        assertEq(nikeVault.asset(), address(mNKE));
        assertEq(nikeVault.brandId(), NIKE);
        assertEq(nikeVault.decimals(), 18 + 6);
        assertEq(nikeVault.symbol(), "sbNKE");
    }

    // 14. deposit / withdraw round-trip
    function testFuzz_depositRedeem_roundTrip(uint96 amount) public {
        vm.assume(amount > 0);
        vm.prank(owner);
        mNKE.mint(alice, amount);
        vm.startPrank(alice);
        mNKE.approve(address(nikeVault), amount);
        uint256 shares = nikeVault.deposit(amount, alice);
        uint256 out = nikeVault.redeem(shares, alice, alice);
        vm.stopPrank();
        assertEq(out, amount);
        assertEq(mNKE.balanceOf(alice), amount);
        assertEq(nikeVault.totalSupply(), 0);
    }

    /// Rewarded users can always exit to the underlying asset, even with claims paused.
    function test_rewardedUser_redeemsWhileRegistryPaused() public {
        (, uint256 shares) = _submit(_claim(alice, 2_000_00));
        vm.prank(owner);
        registry.setPaused(true);
        vm.prank(alice);
        uint256 out = nikeVault.redeem(shares, alice, alice);
        assertEq(out, 15e18);
        assertEq(mNKE.balanceOf(alice), 15e18);
    }

    function test_cannotRedeemOthersShares() public {
        (, uint256 shares) = _submit(_claim(alice, 2_000_00));
        vm.prank(bob);
        vm.expectRevert();
        nikeVault.redeem(shares, bob, alice);
    }

    // 18. first-depositor inflation resistance
    function test_inflationAttack_unprofitable() public {
        // Fresh vault with no deposits.
        vm.prank(owner);
        address v = factory.createVault(SBUX, mNKE, "sbSBUX", "sbSBUX");
        uint256 attackerFunds = 10_000e18;
        uint256 victimDeposit = 1_000e18;
        vm.startPrank(owner);
        mNKE.mint(bob, attackerFunds);
        mNKE.mint(alice, victimDeposit);
        vm.stopPrank();

        // Attacker: deposit 1 wei, then donate the rest to inflate share price.
        vm.startPrank(bob);
        mNKE.approve(v, type(uint256).max);
        uint256 attackerShares = BrandVaultLike(v).deposit(1, bob);
        mNKE.transfer(v, attackerFunds - 1);
        vm.stopPrank();

        vm.startPrank(alice);
        mNKE.approve(v, victimDeposit);
        uint256 victimShares = BrandVaultLike(v).deposit(victimDeposit, alice);
        vm.stopPrank();
        assertGt(victimShares, 0, "victim must not be rounded to zero");

        vm.prank(bob);
        uint256 attackerOut = BrandVaultLike(v).redeem(attackerShares, bob, bob);
        assertLt(attackerOut, attackerFunds, "attack must lose money");
        vm.prank(alice);
        uint256 victimOut = BrandVaultLike(v).redeem(victimShares, alice, alice);
        assertGe(victimOut, (victimDeposit * 999) / 1000, "victim loses < 0.1%");
    }
}

interface BrandVaultLike {
    function deposit(uint256, address) external returns (uint256);
    function redeem(uint256, address, address) external returns (uint256);
}
