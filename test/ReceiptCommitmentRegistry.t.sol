// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim, ClaimStatus, ClaimLib} from "../src/PurchaseClaim.sol";
import {ReceiptCommitmentRegistry} from "../src/ReceiptCommitmentRegistry.sol";
import {IReceiptVerifier} from "../src/interfaces/IReceiptVerifier.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ReceiptCommitmentRegistryTest is StockbackFixture {
    // 1. valid claim accepted -------------------------------------------------

    function test_validClaim_mintsVaultShares() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00); // Rs 2,000
        (bytes32 id, uint256 shares) = _submit(c);

        assertEq(id, registry.claimId(c));
        assertEq(registry.claimOfNullifier(registry.nullifierOf(c)), id);
        assertEq(nikeVault.balanceOf(alice), shares);
        assertEq(nikeVault.convertToAssets(shares), 15e18, "0.75% of Rs 2,000 = 15 mNKE");
        assertEq(pool.budgetOf(NIKE), BUDGET - 15e18);
    }

    function test_validClaim_emitsIndexableEvents() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        bytes32 id = registry.claimId(c);
        bytes32 n = registry.nullifierOf(c);

        vm.expectEmit(address(registry));
        emit ReceiptCommitmentRegistry.PurchaseCommitted(id, n, alice, NIKE, c.merchantId, c.amount, INR);
        vm.expectEmit(address(registry));
        emit ReceiptCommitmentRegistry.RewardAllocated(id, NIKE, alice, 15e18, 15e18 * 1e6);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    function test_preview_matchesSubmit() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        (ClaimStatus s, uint256 reward) = registry.previewClaim(c, att);
        assertEq(uint8(s), uint8(ClaimStatus.Ok));
        assertEq(reward, 15e18);

        vm.prank(alice);
        registry.submitClaim(c, att);
        (s, reward) = registry.previewClaim(c, att);
        assertEq(uint8(s), uint8(ClaimStatus.NullifierUsed));
        assertEq(reward, 0);
    }

    // 2. duplicate claim / 3. reused nullifier ---------------------------------

    function test_duplicateClaim_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        _submit(c);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.NullifierUsed);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    /// Same receipt re-attested with a different amount, claimant, deadline: still the same nullifier.
    function test_reusedNullifier_withAlteredFields_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        _submit(c);

        PurchaseClaim memory c2 = _copy(c);
        c2.claimant = bob;
        c2.amount = 9_000_00;
        c2.deadline = c.deadline + 1;
        assertEq(registry.nullifierOf(c2), registry.nullifierOf(c));
        assertTrue(registry.claimId(c2) != registry.claimId(c));

        bytes memory att = _sign(attesterPk, c2);
        _expectRejected(ClaimStatus.NullifierUsed);
        vm.prank(bob);
        registry.submitClaim(c2, att);
    }

    // 4. wrong claimant ---------------------------------------------------------

    function test_wrongClaimant_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.WrongClaimant);
        vm.prank(bob); // bob front-runs with alice's attestation
        registry.submitClaim(c, att);
    }

    // 5. expired ----------------------------------------------------------------

    function test_expiredClaim_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        vm.warp(c.deadline + 1);
        _expectRejected(ClaimStatus.Expired);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    function test_deadlineBoundary_accepted() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        vm.warp(c.deadline);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    // 6. unauthorized attester --------------------------------------------------

    function test_unauthorizedAttester_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(0xBAD, c);
        _expectRejected(ClaimStatus.BadAttestation);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    function test_revokedAttester_rejected() public {
        vm.prank(owner);
        verifier.setAttester(attester, false);
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        _expectRejected(ClaimStatus.BadAttestation);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    // 10. empty claim / 11. zero amount -----------------------------------------

    function test_emptyFields_rejected() public {
        PurchaseClaim memory base = _claim(alice, 2_000_00);
        for (uint256 i; i < 5; i++) {
            PurchaseClaim memory c = _copy(base);
            if (i == 0) c.brandId = 0;
            if (i == 1) c.merchantId = 0;
            if (i == 2) c.receiptHash = 0;
            if (i == 3) c.currency = 0;
            if (i == 4) c.amount = 0;
            bytes memory att = _sign(attesterPk, c);
            _expectRejected(ClaimStatus.Malformed);
            vm.prank(alice);
            registry.submitClaim(c, att);
        }
    }

    function test_zeroClaimant_previewMalformed() public {
        PurchaseClaim memory c = _claim(address(0), 2_000_00);
        (ClaimStatus s,) = registry.previewClaim(c, _sign(attesterPk, c));
        assertEq(uint8(s), uint8(ClaimStatus.Malformed));
    }

    // 12. malformed attestation -------------------------------------------------

    function test_malformedAttestation_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory good = _sign(attesterPk, c);

        bytes[] memory bad = new bytes[](4);
        bad[0] = "";
        bad[1] = new bytes(65); // all zero
        bad[2] = abi.encodePacked(good, uint8(0)); // 66 bytes
        bad[3] = _sign(attesterPk, _claim(alice, 2_000_00)); // valid sig, other claim
        for (uint256 i; i < bad.length; i++) {
            _expectRejected(ClaimStatus.BadAttestation);
            vm.prank(alice);
            registry.submitClaim(c, bad[i]);
        }
    }

    function test_tamperedAmount_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        c.amount = 20_000_00;
        _expectRejected(ClaimStatus.BadAttestation);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    // 16. paused ----------------------------------------------------------------

    function test_paused_blocksClaims_thenResumes() public {
        vm.prank(owner);
        registry.setPaused(true);
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        vm.expectRevert(ReceiptCommitmentRegistry.ClaimsPaused.selector);
        vm.prank(alice);
        registry.submitClaim(c, att);

        vm.prank(owner);
        registry.setPaused(false);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    // 20. admin -----------------------------------------------------------------

    function test_onlyOwner_admin() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.setPaused(true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.setVerifier(IReceiptVerifier(alice));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.setRewardPolicy(rewardPolicy);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        registry.setEligibilityPolicy(eligibility);
        vm.stopPrank();
    }

    function test_zeroAddress_setters_revert() public {
        vm.startPrank(owner);
        vm.expectRevert(ReceiptCommitmentRegistry.ZeroAddress.selector);
        registry.setVerifier(IReceiptVerifier(address(0)));
        vm.stopPrank();
    }

    // commitment properties -----------------------------------------------------

    function testFuzz_nullifierIndependentOfClaimantAmountDeadline(
        address a,
        address b,
        uint128 x,
        uint128 y,
        uint64 d1,
        uint64 d2
    ) public {
        PurchaseClaim memory c1 = _claim(a, x);
        PurchaseClaim memory c2 = _copy(c1);
        c1.deadline = d1;
        c2.claimant = b;
        c2.amount = y;
        c2.deadline = d2;
        assertEq(registry.nullifierOf(c1), registry.nullifierOf(c2));
    }

    function test_claimIdMatchesEip712StructHash() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes32 expected = keccak256(
            abi.encode(
                ClaimLib.CLAIM_TYPEHASH,
                c.claimant,
                c.brandId,
                c.merchantId,
                c.receiptHash,
                c.amount,
                c.currency,
                c.purchasedAt,
                c.deadline
            )
        );
        assertEq(registry.claimId(c), expected);
    }
}
