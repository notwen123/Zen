// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {USDGRewardAdapter} from "../src/USDGRewardAdapter.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {ISwapRouter} from "../src/interfaces/ISwapRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract USDGRewardAdapterTest is StockbackFixture {
    USDGRewardAdapter adapter;
    MockUSDG usdg;
    MockSwapRouter router;
    MockAggregatorV3 feed;

    function setUp() public override {
        super.setUp();
        usdg = new MockUSDG();
        router = new MockSwapRouter();
        feed = new MockAggregatorV3(8, 2e8); // $2.00 per mNKE (test value)
        vm.startPrank(owner);
        adapter = new USDGRewardAdapter(owner, usdg, pool, factory, router);
        adapter.setPriceFeed(NIKE, feed);
        mNKE.mint(address(router), 1_000_000e18);
        vm.stopPrank();
        // router pays exactly the oracle price: 1 USDG (1e6) -> 0.5 mNKE (5e17) => rate per 1e18 in = 5e29
        router.setRate(address(usdg), address(mNKE), 5e29);
        usdg.mint(sponsor, 1_000e6);
        vm.prank(sponsor);
        usdg.approve(address(adapter), type(uint256).max);
    }

    function test_fundWithUSDG_creditsBudget() public {
        assertEq(adapter.expectedOut(NIKE, 100e6), 50e18);
        vm.prank(sponsor);
        uint256 out = adapter.fundWithUSDG(NIKE, 100e6);
        assertEq(out, 50e18);
        assertEq(pool.budgetOf(NIKE), BUDGET + 50e18);
        assertEq(usdg.balanceOf(address(adapter)), 0, "adapter holds nothing");
        assertEq(mNKE.balanceOf(address(adapter)), 0, "adapter holds nothing");
    }

    function test_usdgFundedBudget_paysClaims() public {
        vm.prank(owner);
        pool.withdrawBudget(NIKE, BUDGET, owner);
        vm.prank(sponsor);
        adapter.fundWithUSDG(NIKE, 100e6); // 50 mNKE budget
        (, uint256 shares) = _submit(_claim(alice, 2_000_00));
        assertEq(nikeVault.convertToAssets(shares), 15e18);
        assertEq(pool.budgetOf(NIKE), 35e18);
    }

    function test_slippage_reverts() public {
        router.setRate(address(usdg), address(mNKE), 4.9e29); // 2% worse than oracle, cap 1%
        vm.prank(sponsor);
        vm.expectRevert("MockRouter: slippage");
        adapter.fundWithUSDG(NIKE, 100e6);
    }

    function test_staleOracle_reverts() public {
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(sponsor);
        vm.expectRevert(USDGRewardAdapter.StaleOracle.selector);
        adapter.fundWithUSDG(NIKE, 100e6);
    }

    function test_nonPositivePrice_reverts() public {
        feed.setAnswer(0);
        vm.prank(sponsor);
        vm.expectRevert(USDGRewardAdapter.BadOraclePrice.selector);
        adapter.fundWithUSDG(NIKE, 100e6);
        feed.setAnswer(-1);
        vm.prank(sponsor);
        vm.expectRevert(USDGRewardAdapter.BadOraclePrice.selector);
        adapter.fundWithUSDG(NIKE, 100e6);
    }

    function test_guards() public {
        vm.startPrank(sponsor);
        vm.expectRevert(USDGRewardAdapter.ZeroAmount.selector);
        adapter.fundWithUSDG(NIKE, 0);
        vm.expectRevert(abi.encodeWithSelector(USDGRewardAdapter.NoVault.selector, SBUX));
        adapter.fundWithUSDG(SBUX, 1e6);
        vm.stopPrank();

        vm.prank(owner);
        factory.createVault(SBUX, mNKE, "sbSBUX", "sbSBUX");
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(USDGRewardAdapter.NoFeed.selector, SBUX));
        adapter.fundWithUSDG(SBUX, 1e6);
    }

    function test_admin() public {
        vm.startPrank(owner);
        vm.expectRevert(USDGRewardAdapter.SlippageTooHigh.selector);
        adapter.setMaxSlippageBps(1001);
        adapter.setMaxSlippageBps(1000);
        vm.expectRevert(USDGRewardAdapter.ZeroAddress.selector);
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

    /// Selector must be SwapRouter02's (no deadline), the router deployed on Robinhood Chain.
    function test_routerSelector_isSwapRouter02() public pure {
        assertEq(ISwapRouter.exactInputSingle.selector, bytes4(0x04e45aaf));
    }
}
