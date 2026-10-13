// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ZenFixture} from "./utils/ZenFixture.sol";
import {AUSDRewardAdapter} from "../src/AUSDRewardAdapter.sol";
import {MockAUSD} from "../src/mocks/MockAUSD.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {ISwapRouter} from "../src/interfaces/ISwapRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AUSDRewardAdapterTest is ZenFixture {
    AUSDRewardAdapter adapter;
    MockAUSD ausd;
    MockSwapRouter router;
    MockAggregatorV3 feed;

    function setUp() public override {
        super.setUp();
        ausd = new MockAUSD();
        router = new MockSwapRouter();
        feed = new MockAggregatorV3(8, 2e8); // $2.00 per mNKE (test value)
        vm.startPrank(owner);
        adapter = new AUSDRewardAdapter(owner, ausd, pool, factory, router);
        adapter.setPriceFeed(NIKE, feed);
        mNKE.mint(address(router), 1_000_000e18);
        vm.stopPrank();
        // router pays exactly the oracle price: 1 AUSD (1e6) -> 0.5 mNKE (5e17) => rate per 1e18 in = 5e29
        router.setRate(address(ausd), address(mNKE), 5e29);
        ausd.mint(sponsor, 1_000e6);
        vm.prank(sponsor);
        ausd.approve(address(adapter), type(uint256).max);
    }

    function test_fundWithAUSD_creditsBudget() public {
        assertEq(adapter.expectedOut(NIKE, 100e6), 50e18);
        vm.prank(sponsor);
        uint256 out = adapter.fundWithAUSD(NIKE, 100e6);
        assertEq(out, 50e18);
        assertEq(pool.budgetOf(NIKE), BUDGET + 50e18);
        assertEq(ausd.balanceOf(address(adapter)), 0, "adapter holds nothing");
        assertEq(mNKE.balanceOf(address(adapter)), 0, "adapter holds nothing");
    }

    function test_ausdFundedBudget_paysClaims() public {
        vm.prank(owner);
        pool.withdrawBudget(NIKE, BUDGET, owner);
        vm.prank(sponsor);
        adapter.fundWithAUSD(NIKE, 100e6); // 50 mNKE budget
        (, uint256 pos) = _submit(_claim(alice, 2_000_00));
        assertEq(_amt(pos), 15e18);
        assertEq(pool.budgetOf(NIKE), 35e18);
    }

    function test_slippage_reverts() public {
        router.setRate(address(ausd), address(mNKE), 4.9e29); // 2% worse than oracle, cap 1%
        vm.prank(sponsor);
        vm.expectRevert("MockRouter: slippage");
        adapter.fundWithAUSD(NIKE, 100e6);
    }

    function test_staleOracle_reverts() public {
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(sponsor);
        vm.expectRevert(AUSDRewardAdapter.StaleOracle.selector);
        adapter.fundWithAUSD(NIKE, 100e6);
    }

    function test_nonPositivePrice_reverts() public {
        feed.setAnswer(0);
        vm.prank(sponsor);
        vm.expectRevert(AUSDRewardAdapter.BadOraclePrice.selector);
        adapter.fundWithAUSD(NIKE, 100e6);
        feed.setAnswer(-1);
        vm.prank(sponsor);
        vm.expectRevert(AUSDRewardAdapter.BadOraclePrice.selector);
        adapter.fundWithAUSD(NIKE, 100e6);
    }

    function test_guards() public {
        vm.startPrank(sponsor);
        vm.expectRevert(AUSDRewardAdapter.ZeroAmount.selector);
        adapter.fundWithAUSD(NIKE, 0);
        vm.expectRevert(abi.encodeWithSelector(AUSDRewardAdapter.NoVault.selector, SBUX));
        adapter.fundWithAUSD(SBUX, 1e6);
        vm.stopPrank();

        vm.prank(owner);
        factory.createVault(SBUX, mNKE, "sbSBUX", "sbSBUX");
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(AUSDRewardAdapter.NoFeed.selector, SBUX));
        adapter.fundWithAUSD(SBUX, 1e6);
    }

    function test_admin() public {
        vm.startPrank(owner);
        vm.expectRevert(AUSDRewardAdapter.SlippageTooHigh.selector);
        adapter.setMaxSlippageBps(1001);
        adapter.setMaxSlippageBps(1000);
        vm.expectRevert(AUSDRewardAdapter.ZeroAddress.selector);
        adapter.setRouter(ISwapRouter(address(0)), 500);
        vm.stopPrank();

        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        adapter.setMaxSlippageBps(1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        adapter.setPriceFeed(NIKE, feed);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        adapter.setOracleStaleAfter(1);
        vm.stopPrank();
    }

    /// Selector must be SwapRouter02's (no deadline layout).
    function test_routerSelector_isSwapRouter02() public pure {
        assertEq(ISwapRouter.exactInputSingle.selector, bytes4(0x04e45aaf));
    }
}
