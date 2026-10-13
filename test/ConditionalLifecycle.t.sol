// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ZenFixture} from "./utils/ZenFixture.sol";
import {ConditionalClaim} from "../src/ConditionalClaim.sol";
import {VoidOracle} from "../src/VoidOracle.sol";
import {InstantExitPool} from "../src/InstantExitPool.sol";
import {IConditionalClaim} from "../src/interfaces/IConditionalClaim.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @notice The conditional-claim lifecycle: lock -> (sell) -> settle | void, and the exit pool's books.
contract ConditionalLifecycleTest is ZenFixture {
    uint256 constant AMT = 15e18; // reward for a Rs 2,000 Nike purchase

    function _claimNike(address who) internal returns (uint256 pos) {
        (, pos) = _submit(_claim(who, 2_000_00));
    }

    function _sell(address who, uint256 pos) internal returns (uint256 price) {
        vm.startPrank(who);
        conditional.approve(address(exitPool), pos);
        price = exitPool.sellClaim(pos, 0);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- happy paths

    function test_claim_lock_sell_settle_lpGains() public {
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        (uint256 quoted,) = exitPool.quote(pos);
        uint256 navBefore = exitPool.totalAssets();

        uint256 price = _sell(alice, pos);
        assertEq(price, quoted);
        assertLt(price, AMT, "sold at a discount");
        assertEq(mNKE.balanceOf(alice), price, "seller paid immediately");
        assertEq(conditional.ownerOf(pos), address(exitPool));
        assertEq(exitPool.totalAssets(), navBefore, "buying a claim is NAV-neutral at book cost");
        assertEq(exitPool.heldCount(), 1);

        vm.warp(conditional.claimOf(pos).unlockAt);
        vm.prank(bob); // anyone can settle
        conditional.settle(pos);

        assertEq(uint8(conditional.statusOf(pos)), uint8(IConditionalClaim.Status.Settled));
        assertEq(exitPool.totalAssets(), navBefore + AMT - price, "gain recognized at settle");
        assertEq(exitPool.realizedGains(), AMT - price);
        assertEq(exitPool.heldCount(), 0);
        assertEq(exitPool.totalBooked(), 0);
        assertEq(conditional.escrowed(address(mNKE)), 0);
    }

    function test_claim_void_returnsEscrowToSponsorBudget() public {
        uint256 pos = _claimNike(alice);
        assertEq(pool.budgetOf(NIKE), BUDGET - AMT);
        _void(pos, keccak256("refund:R-1"));

        assertEq(uint8(conditional.statusOf(pos)), uint8(IConditionalClaim.Status.Voided));
        assertEq(pool.budgetOf(NIKE), BUDGET, "escrow back in the budget");
        assertEq(mNKE.balanceOf(address(pool)), BUDGET);
        assertEq(conditional.escrowed(address(mNKE)), 0);
        assertEq(mNKE.balanceOf(alice), 0, "refunded buyer keeps nothing");
        (uint32 n, uint32 v) = conditional.historyOf(alice);
        assertEq(n, 1);
        assertEq(v, 1, "onchain refund history");
    }

    function test_sell_then_void_isLpLoss() public {
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        uint256 navBefore = exitPool.totalAssets();
        uint256 price = _sell(alice, pos);

        _void(pos, keccak256("refund:R-2"));
        assertEq(exitPool.totalAssets(), navBefore - price, "LP loses the price paid");
        assertEq(exitPool.realizedLosses(), price);
        assertEq(exitPool.heldCount(), 0);
        assertEq(mNKE.balanceOf(alice), price, "seller keeps the cash; the LP carried the refund risk");
        assertEq(pool.budgetOf(NIKE), BUDGET, "sponsor made whole");
    }

    function test_settle_paysCurrentHolder_afterTransfer() public {
        uint256 pos = _claimNike(alice);
        vm.prank(alice);
        conditional.transferFrom(alice, bob, pos); // transferable while Locked
        vm.warp(conditional.claimOf(pos).unlockAt);
        conditional.settle(pos);
        assertEq(mNKE.balanceOf(bob), AMT);
        assertEq(mNKE.balanceOf(alice), 0);
    }

    // ---------------------------------------------------------------- guards

    function test_minHold_enforced() public {
        uint256 pos = _claimNike(alice);
        vm.startPrank(alice);
        conditional.approve(address(exitPool), pos);
        uint256 sellableAt = conditional.claimOf(pos).mintedAt + MIN_HOLD;
        vm.expectRevert(abi.encodeWithSelector(InstantExitPool.MinHold.selector, pos, sellableAt));
        exitPool.sellClaim(pos, 0);
        vm.warp(sellableAt);
        exitPool.sellClaim(pos, 0);
        vm.stopPrank();
    }

    function test_slippage_minOut() public {
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        (uint256 q,) = exitPool.quote(pos);
        vm.startPrank(alice);
        conditional.approve(address(exitPool), pos);
        vm.expectRevert(abi.encodeWithSelector(InstantExitPool.Slippage.selector, q, q + 1));
        exitPool.sellClaim(pos, q + 1);
        assertEq(exitPool.sellClaim(pos, q), q);
        vm.stopPrank();
    }

    function test_onlyHolder_canSell() public {
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        vm.prank(alice);
        conditional.approve(address(exitPool), pos);
        vm.prank(bob);
        vm.expectRevert(InstantExitPool.NotHolder.selector);
        exitPool.sellClaim(pos, 0);
    }

    function test_cannotSellAfterUnlock_orResolved() public {
        uint256 pos = _claimNike(alice);
        vm.warp(conditional.claimOf(pos).unlockAt);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(InstantExitPool.NotForSale.selector, pos));
        exitPool.sellClaim(pos, 0);
        (uint256 q,) = exitPool.quote(pos);
        assertEq(q, 0);
    }

    function test_insufficientLiquidity() public {
        vm.startPrank(lp);
        exitPool.withdraw(exitPool.maxWithdraw(lp), lp, lp);
        vm.stopPrank();
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        vm.startPrank(alice);
        conditional.approve(address(exitPool), pos);
        vm.expectRevert();
        exitPool.sellClaim(pos, 0);
        vm.stopPrank();
    }

    function test_voidAfterUnlock_rejected() public {
        uint256 pos = _claimNike(alice);
        uint64 unlockAt = conditional.claimOf(pos).unlockAt;
        vm.warp(unlockAt);
        bytes32 ref = keccak256("refund:late");
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRefund(refundPk, pos, ref, dl);
        vm.expectRevert(abi.encodeWithSelector(ConditionalClaim.WindowClosed.selector, pos, unlockAt));
        voidOracle.voidWithAttestation(pos, ref, dl, sig);
    }

    function test_replayedVoid_rejected() public {
        uint256 p1 = _claimNike(alice);
        uint256 p2 = _claimNike(bob);
        bytes32 ref = keccak256("refund:R-9");
        _void(p1, ref);
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes memory sig = _signRefund(refundPk, p2, ref, dl);
        vm.expectRevert(abi.encodeWithSelector(VoidOracle.RefundReplayed.selector, ref));
        voidOracle.voidWithAttestation(p2, ref, dl, sig); // same refund, different claim
        // and the same claim cannot be voided twice under a fresh ref
        bytes32 ref2 = keccak256("refund:R-10");
        sig = _signRefund(refundPk, p1, ref2, dl);
        vm.expectRevert(abi.encodeWithSelector(ConditionalClaim.NotLocked.selector, p1));
        voidOracle.voidWithAttestation(p1, ref2, dl, sig);
    }

    function test_void_requiresAllowlistedAttester_andFreshDeadline() public {
        uint256 pos = _claimNike(alice);
        bytes32 ref = keccak256("refund:forged");
        uint64 dl = uint64(block.timestamp + 1 hours);
        bytes memory forged = _signRefund(attesterPk, pos, ref, dl); // purchase attester, not refund attester
        vm.expectRevert(abi.encodeWithSelector(VoidOracle.NotAttester.selector, attester));
        voidOracle.voidWithAttestation(pos, ref, dl, forged);

        bytes memory ok = _signRefund(refundPk, pos, ref, dl);
        vm.warp(dl + 1);
        vm.expectRevert(VoidOracle.Expired.selector);
        voidOracle.voidWithAttestation(pos, ref, dl, ok);
    }

    function test_onlyOracle_voids_onlyPool_mints() public {
        uint256 pos = _claimNike(alice);
        vm.prank(owner);
        vm.expectRevert(ConditionalClaim.NotVoidOracle.selector);
        conditional.voidClaim(pos);
        vm.prank(owner);
        vm.expectRevert(ConditionalClaim.NotPool.selector);
        conditional.mint(owner, NIKE, address(mNKE), 1, 0);
    }

    function test_settleBeforeUnlock_rejected_andResolvedIsFrozen() public {
        uint256 pos = _claimNike(alice);
        uint64 unlockAt = conditional.claimOf(pos).unlockAt;
        vm.expectRevert(abi.encodeWithSelector(ConditionalClaim.StillLocked.selector, pos, unlockAt));
        conditional.settle(pos);
        vm.warp(unlockAt);
        conditional.settle(pos);
        vm.expectRevert(abi.encodeWithSelector(ConditionalClaim.NotLocked.selector, pos));
        conditional.settle(pos);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ConditionalClaim.Frozen.selector, pos));
        conditional.transferFrom(alice, bob, pos);
    }

    function test_wire_isOneTime_andConfigBounded() public {
        vm.startPrank(owner);
        vm.expectRevert(ConditionalClaim.AlreadyWired.selector);
        conditional.wire(owner, owner);
        vm.expectRevert(ConditionalClaim.BadConfig.selector);
        conditional.setReturnWindow(FASHION, 91 days, false);
        vm.expectRevert(InstantExitPool.BadParams.selector);
        exitPool.setCategoryParams(
            FASHION, InstantExitPool.CategoryParams({pRefundBps: 9_001, minHoldSeconds: 0, enabled: true})
        );
        vm.expectRevert(InstantExitPool.BadParams.selector);
        exitPool.setPricing(5_001, 0, 0);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- risk pricing

    function test_walletRisk_raisesDiscount_afterVoid() public {
        uint256 first = _claimNike(alice);
        uint256 clean = _claimNike(bob);
        vm.warp(block.timestamp + MIN_HOLD);
        (uint256 bobQuote,) = exitPool.quote(clean);
        (uint256 aliceBefore,) = exitPool.quote(first);
        assertEq(aliceBefore, bobQuote, "same history, same price");

        _void(first, keccak256("refund:alice-1"));
        uint256 second = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        assertEq(exitPool.walletRiskMult(alice), 10_000 + uint256(RISK_SLOPE_BPS) / 2, "1 void of 2 claims");
        (uint256 aliceAfter,) = exitPool.quote(second);
        (uint256 bobNow,) = exitPool.quote(clean);
        assertLt(aliceAfter, bobNow, "a wallet that refunds gets a bigger haircut");
    }

    function test_quote_workedExample() public {
        // 15 mNKE, fashion p=25%, clean wallet, 30 days less 1h to unlock, 10%/yr time value, 1% fee.
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        uint256 secs = conditional.claimOf(pos).unlockAt - block.timestamp;
        (uint256 q,) = exitPool.quote(pos);
        uint256 expected = AMT * 7_500 / 10_000;
        expected = expected * (10_000 - TIME_VALUE_BPS * secs / 365 days) / 10_000;
        expected = expected * (10_000 - LP_FEE_BPS) / 10_000;
        assertEq(q, expected);
        assertApproxEqRel(q, 11.04e18, 0.01e18); // ~73.6% of face value
    }

    // ---------------------------------------------------------------- LP share math

    function test_lpShares_reflectGainsAndLosses() public {
        address lp2 = makeAddr("lp2");
        uint256 lpShares = exitPool.balanceOf(lp);

        // A claim is bought and settles: NAV per share rises, so a later LP gets fewer shares.
        uint256 win = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        uint256 price = _sell(alice, win);
        vm.warp(conditional.claimOf(win).unlockAt);
        conditional.settle(win);
        uint256 gain = AMT - price;
        assertApproxEqAbs(exitPool.convertToAssets(lpShares), LP_SEED + gain, 1);

        vm.prank(owner);
        mNKE.mint(lp2, 1_000e18);
        vm.startPrank(lp2);
        mNKE.approve(address(exitPool), 1_000e18);
        uint256 s2 = exitPool.deposit(1_000e18, lp2);
        vm.stopPrank();
        assertLt(s2 * LP_SEED, lpShares * 1_000e18, "late LP pays the higher NAV");

        // A held claim is voided: the loss is shared pro rata.
        uint256 navBefore = exitPool.totalAssets();
        uint256 lose = _claimNike(bob);
        vm.warp(block.timestamp + MIN_HOLD);
        uint256 p2 = _sell(bob, lose);
        _void(lose, keccak256("refund:bob"));
        assertEq(exitPool.totalAssets(), navBefore - p2);
        assertApproxEqAbs(
            exitPool.convertToAssets(s2) * 1e18 / 1_000e18,
            exitPool.convertToAssets(lpShares) * 1e18 / (LP_SEED + gain),
            1e9,
            "both LPs take the same % loss"
        );
    }

    function test_withdrawals_limitedToIdle() public {
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        uint256 price = _sell(alice, pos);
        assertEq(exitPool.maxWithdraw(lp), LP_SEED - price, "capital in claims is not withdrawable");
        vm.prank(lp);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxWithdraw.selector, lp, LP_SEED, LP_SEED - price)
        );
        exitPool.withdraw(LP_SEED, lp, lp);
        vm.prank(lp);
        exitPool.withdraw(LP_SEED - price, lp, lp);
    }

    function test_reconcile_isIdempotent() public {
        uint256 pos = _claimNike(alice);
        vm.warp(block.timestamp + MIN_HOLD);
        _sell(alice, pos);
        vm.warp(conditional.claimOf(pos).unlockAt);
        conditional.settle(pos);
        uint256 nav = exitPool.totalAssets();
        exitPool.reconcile(pos); // callback already booked it: no-op
        assertEq(exitPool.totalAssets(), nav);
    }

    // ---------------------------------------------------------------- fuzz: pricing bounds

    function testFuzz_price_neverExceedsAmount(uint128 amount, uint16 p, uint32 mult, uint32 secs) public view {
        uint256 pr = bound(p, 0, 9_000);
        uint256 m = bound(mult, 10_000, 30_000);
        uint256 s = bound(secs, 0, 365 days);
        assertLe(exitPool.priceFor(amount, pr, m, s), amount);
    }

    function testFuzz_price_monotonicInRisk(uint128 amount, uint16 p1, uint16 p2, uint32 m1, uint32 m2, uint32 secs)
        public
        view
    {
        uint256 lo = bound(p1, 0, 9_000);
        uint256 hi = bound(p2, lo, 9_000);
        uint256 mLo = bound(m1, 10_000, 30_000);
        uint256 mHi = bound(m2, mLo, 30_000);
        uint256 s = bound(secs, 0, 90 days);
        assertGe(exitPool.priceFor(amount, lo, mLo, s), exitPool.priceFor(amount, hi, mLo, s), "risk up, price down");
        assertGe(exitPool.priceFor(amount, lo, mLo, s), exitPool.priceFor(amount, lo, mHi, s), "wallet risk up");
    }

    function testFuzz_price_monotonicInTime(uint128 amount, uint16 p, uint32 s1, uint32 s2) public view {
        uint256 pr = bound(p, 0, 9_000);
        uint256 a = bound(s1, 0, 90 days);
        uint256 b = bound(s2, a, 90 days);
        assertGe(exitPool.priceFor(amount, pr, 10_000, a), exitPool.priceFor(amount, pr, 10_000, b));
    }
}
