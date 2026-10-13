// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim, ClaimStatus} from "../src/PurchaseClaim.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RewardPoolTest is StockbackFixture {
    function test_fund_anySponsor() public {
        vm.prank(owner);
        mNKE.mint(bob, 5e18);
        vm.startPrank(bob);
        mNKE.approve(address(pool), 5e18);
        pool.fund(NIKE, 5e18);
        vm.stopPrank();
        assertEq(pool.budgetOf(NIKE), BUDGET + 5e18);
    }

    function test_fund_rejectsZeroAndUnknownBrand() public {
        vm.expectRevert(RewardPool.ZeroAmount.selector);
        pool.fund(NIKE, 0);
        vm.expectRevert(abi.encodeWithSelector(RewardPool.NoVault.selector, SBUX));
        pool.fund(SBUX, 1);
    }

    function test_allocate_onlyRegistry() public {
        vm.prank(owner); // not even the owner
        vm.expectRevert(RewardPool.NotRegistry.selector);
        pool.allocate(NIKE, owner, 1);
    }

    function test_donation_doesNotInflateBudget() public {
        vm.prank(owner);
        mNKE.mint(address(pool), 1e18);
        assertEq(pool.budgetOf(NIKE), BUDGET);
    }

    // Budget exhaustion: rejected with a status, receipt remains claimable after refunding.
    function test_budgetExhaustion_rejects_thenRecovers() public {
        vm.prank(owner);
        pool.withdrawBudget(NIKE, BUDGET - 10e18, sponsor);

        PurchaseClaim memory c = _claim(alice, 2_000_00); // reward 15 > budget 10
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.BudgetExhausted);
        vm.prank(alice);
        registry.submitClaim(c, att);

        vm.startPrank(sponsor);
        mNKE.approve(address(pool), 5e18);
        pool.fund(NIKE, 5e18);
        vm.stopPrank();
        vm.prank(alice);
        registry.submitClaim(c, att);
        assertEq(pool.budgetOf(NIKE), 0);
    }

    // 17. emergency: owner can pull unallocated budget, never user shares.
    function test_emergencyWithdrawBudget_leavesUserSharesIntact() public {
        (, uint256 shares) = _submit(_claim(alice, 2_000_00));
        vm.startPrank(owner);
        registry.setPaused(true);
        pool.withdrawBudget(NIKE, pool.budgetOf(NIKE), owner);
        vm.stopPrank();
        assertEq(pool.budgetOf(NIKE), 0);
        assertEq(mNKE.balanceOf(address(pool)), 0);
        assertEq(nikeVault.totalAssets(), 15e18);
        vm.prank(alice);
        assertEq(nikeVault.redeem(shares, alice, alice), 15e18);
    }

    function test_withdrawBudget_guards() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        pool.withdrawBudget(NIKE, 1, alice);
        vm.startPrank(owner);
        vm.expectRevert(RewardPool.InsufficientBudget.selector);
        pool.withdrawBudget(NIKE, BUDGET + 1, owner);
        vm.expectRevert(RewardPool.ZeroAddress.selector);
        pool.withdrawBudget(NIKE, 1, address(0));
        vm.stopPrank();
    }
}
