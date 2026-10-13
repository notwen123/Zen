// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim, ClaimStatus} from "../src/PurchaseClaim.sol";
import {RewardPolicy} from "../src/RewardPolicy.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract RewardPolicyTest is StockbackFixture {
    function _quote(PurchaseClaim memory c) internal view returns (ClaimStatus s, uint256 r) {
        return rewardPolicy.quote(c);
    }

    function _cfg(uint128 rate, uint16 mult, uint128 perClaim, uint128 user, uint128 brand)
        internal
        pure
        returns (RewardPolicy.BrandConfig memory)
    {
        return RewardPolicy.BrandConfig(rate, mult, perClaim, user, brand);
    }

    function test_formula_exact() public {
        (ClaimStatus s, uint256 r) = _quote(_claim(alice, 2_000_00));
        assertEq(uint8(s), uint8(ClaimStatus.Ok));
        assertEq(r, 15e18);
        (, r) = _quote(_claim(alice, 1)); // 1 paise
        assertEq(r, 7.5e13);
    }

    function test_multiplier() public {
        vm.prank(owner);
        rewardPolicy.setBrandConfig(NIKE, _cfg(RATE_WAD, 20_000, PER_CLAIM_CAP, DAILY_USER_CAP, DAILY_BRAND_CAP));
        (, uint256 r) = _quote(_claim(alice, 2_000_00));
        assertEq(r, 30e18);
    }

    // 7. per-claim cap: clipped, not rejected
    function test_perClaimCap_clips() public {
        (ClaimStatus s, uint256 r) = _quote(_claim(alice, 100_000_00)); // Rs 1 lakh -> 750 uncapped
        assertEq(uint8(s), uint8(ClaimStatus.Ok));
        assertEq(r, PER_CLAIM_CAP);
    }

    // 8. daily user cap: rejected, receipt stays claimable next day
    function test_dailyUserCap_enforced_andResetsNextDay() public {
        for (uint256 i; i < 3; i++) {
            _submit(_claim(alice, 100_000_00)); // 100 each -> 300 = cap
        }
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.UserDailyCapReached);
        vm.prank(alice);
        registry.submitClaim(c, att);

        // other users unaffected
        _submit(_claim(bob, 2_000_00));

        // same receipt works tomorrow (nullifier was not burned)
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    // 9. daily brand cap
    function test_dailyBrandCap_enforced() public {
        vm.prank(owner);
        rewardPolicy.setBrandConfig(NIKE, _cfg(RATE_WAD, 10_000, 100e18, 100e18, 150e18));
        _submit(_claim(alice, 100_000_00));
        PurchaseClaim memory c = _claim(bob, 100_000_00);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.BrandDailyCapReached);
        vm.prank(bob);
        registry.submitClaim(c, att);
    }

    function test_zeroReward_unconfiguredBrand() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        c.brandId = SBUX;
        (ClaimStatus s, uint256 r) = _quote(c);
        assertEq(uint8(s), uint8(ClaimStatus.ZeroReward));
        assertEq(r, 0);
    }

    function test_roundsDownToZero_rejected() public {
        vm.prank(owner);
        rewardPolicy.setBrandConfig(NIKE, _cfg(1, 1, 1, 1, 1)); // 1 wei per 1e22 paise
        (ClaimStatus s,) = _quote(_claim(alice, 2_000_00));
        assertEq(uint8(s), uint8(ClaimStatus.ZeroReward));
    }

    function test_consume_onlyRegistry() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        vm.expectRevert(RewardPolicy.NotRegistry.selector);
        rewardPolicy.consume(c);
    }

    function test_consume_recordsUsage() public {
        _submit(_claim(alice, 2_000_00));
        uint256 day = block.timestamp / 1 days;
        assertEq(rewardPolicy.userIssued(NIKE, alice, day), 15e18);
        assertEq(rewardPolicy.brandIssued(NIKE, day), 15e18);
    }

    function test_badConfig_revert() public {
        RewardPolicy.BrandConfig[6] memory bad = [
            _cfg(0, 10_000, 1, 1, 1),
            _cfg(1, 0, 1, 1, 1),
            _cfg(1, 30_001, 1, 1, 1),
            _cfg(1, 10_000, 0, 1, 1),
            _cfg(1, 10_000, 2, 1, 2),
            _cfg(1, 10_000, 1, 2, 1)
        ];
        vm.startPrank(owner);
        for (uint256 i; i < bad.length; i++) {
            vm.expectRevert(RewardPolicy.BadConfig.selector);
            rewardPolicy.setBrandConfig(NIKE, bad[i]);
        }
        vm.expectRevert(RewardPolicy.BadConfig.selector);
        rewardPolicy.setBrandConfig(0, _cfg(1, 1, 1, 1, 1));
        vm.stopPrank();
    }

    // 20. unauthorized reward configuration
    function test_onlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        rewardPolicy.setBrandConfig(NIKE, _cfg(1, 1, 1, 1, 1));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        rewardPolicy.setRegistry(alice);
        vm.stopPrank();
    }

    /// Reward is monotonic in amount, never exceeds perClaimCap, and never overflows
    /// for any uint128 amount and any valid config.
    function testFuzz_rewardBoundedAndMonotonic(uint128 a, uint128 b, uint128 rate, uint16 mult, uint128 cap) public {
        rate = uint128(bound(rate, 1, type(uint128).max));
        mult = uint16(bound(mult, 1, 30_000));
        cap = uint128(bound(cap, 1, type(uint128).max / 4));
        vm.prank(owner);
        rewardPolicy.setBrandConfig(NIKE, _cfg(rate, mult, cap, cap * 2, cap * 4));
        (a, b) = a < b ? (a, b) : (b, a);

        PurchaseClaim memory ca = _claim(alice, a);
        PurchaseClaim memory cb = _claim(alice, b);
        (, uint256 ra) = _quote(ca);
        (, uint256 rb) = _quote(cb);
        assertLe(ra, rb);
        assertLe(rb, cap);
    }
}
