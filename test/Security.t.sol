// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {PurchaseClaim, ClaimStatus} from "../src/PurchaseClaim.sol";
import {ReceiptCommitmentRegistry} from "../src/ReceiptCommitmentRegistry.sol";
import {RewardPolicy} from "../src/RewardPolicy.sol";
import {RewardPool} from "../src/RewardPool.sol";
import {IReceiptVerifier} from "../src/interfaces/IReceiptVerifier.sol";
import {MockBrandAsset} from "../src/mocks/MockBrandAsset.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AlwaysTrueVerifier is IReceiptVerifier {
    function verify(bytes32, bytes calldata) external pure returns (bool) {
        return true;
    }
}

/// Asset whose transferFrom re-enters the registry.
contract ReentrantAsset is ERC20 {
    ReceiptCommitmentRegistry public target;
    PurchaseClaim internal _c;
    bool internal _armed;

    constructor() ERC20("Reentrant", "RE") {}

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }

    function arm(ReceiptCommitmentRegistry t, PurchaseClaim calldata c) external {
        target = t;
        _c = c;
        _armed = true;
    }

    function transferFrom(address f, address t, uint256 a) public override returns (bool) {
        if (_armed) {
            _armed = false;
            target.submitClaim(_c, "");
        }
        return super.transferFrom(f, t, a);
    }
}

contract SecurityTest is StockbackFixture {
    // --- verifier authority is bounded -----------------------------------------------

    /// Worst case: owner key compromised and verifier replaced with one that accepts anything.
    /// Damage is still bounded by per-claim cap, daily caps and budget; existing users' shares
    /// are untouched because nothing can move assets out of a vault except the share holder.
    function test_compromisedVerifier_boundedByCapsAndBudget() public {
        (, uint256 aliceShares) = _submit(_claim(alice, 2_000_00));

        AlwaysTrueVerifier evilVerifier = new AlwaysTrueVerifier();
        vm.prank(owner);
        registry.setVerifier(evilVerifier);
        address attacker = makeAddr("attacker");
        uint256 day = block.timestamp / 1 days;
        for (uint256 i; i < 10; i++) {
            PurchaseClaim memory c = _claim(attacker, 500_000_00); // max eligible amount
            vm.prank(attacker);
            try registry.submitClaim(c, "") {} catch {}
        }
        assertEq(rewardPolicy.userIssued(NIKE, attacker, day), DAILY_USER_CAP, "capped at daily user cap");
        assertEq(nikeVault.convertToAssets(nikeVault.balanceOf(attacker)), DAILY_USER_CAP);
        assertEq(nikeVault.convertToAssets(aliceShares), 15e18, "honest shares untouched");
    }

    function test_verifierAddress_cannotAllocateOrConsume() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        vm.startPrank(address(verifier));
        vm.expectRevert(RewardPool.NotRegistry.selector);
        pool.allocate(NIKE, address(verifier), 1);
        vm.expectRevert(RewardPolicy.NotRegistry.selector);
        rewardPolicy.consume(c);
        vm.stopPrank();
    }

    // --- signature domain separation -------------------------------------------------

    function test_crossChainReplay_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        vm.chainId(46630 + 1);
        _expectRejected(ClaimStatus.BadAttestation);
        vm.prank(alice);
        registry.submitClaim(c, att);
    }

    function test_crossDeploymentReplay_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        bytes memory att = _sign(attesterPk, c);
        ReceiptCommitmentRegistry other =
            new ReceiptCommitmentRegistry(owner, verifier, eligibility, rewardPolicy, pool);
        (ClaimStatus s,) = other.previewClaim(c, att);
        assertEq(uint8(s), uint8(ClaimStatus.BadAttestation));
    }

    function test_highS_malleableSignature_rejected() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attesterPk, registry.claimDigest(c));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes memory flipped = abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        _expectRejected(ClaimStatus.BadAttestation);
        vm.prank(alice);
        registry.submitClaim(c, flipped);
    }

    // --- reentrancy -----------------------------------------------------------------

    function test_reentrancyThroughAssetHook_blocked() public {
        bytes32 EVIL = bytes32("EVIL");
        ReentrantAsset evil = new ReentrantAsset();
        vm.startPrank(owner);
        factory.createVault(EVIL, evil, "x", "x");
        _configureBrand(EVIL);
        registry.setVerifier(new AlwaysTrueVerifier());
        vm.stopPrank();
        evil.mint(address(this), 1_000e18);
        evil.approve(address(pool), 1_000e18);
        pool.fund(EVIL, 1_000e18);

        PurchaseClaim memory c = _claim(alice, 2_000_00);
        c.brandId = EVIL;
        PurchaseClaim memory inner = _claim(alice, 2_000_00);
        inner.brandId = EVIL;
        evil.arm(registry, inner);

        vm.prank(alice);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        registry.submitClaim(c, "");
    }

    // --- mocks can never reach production chains ------------------------------------

    function test_mocks_refuseProductionChains() public {
        uint256[2] memory prod = [uint256(4663), 42161];
        for (uint256 i; i < 2; i++) {
            vm.chainId(prod[i]);
            vm.expectRevert(MockBrandAsset.ProductionChain.selector);
            new MockBrandAsset("m", "m", owner);
            vm.expectRevert(MockUSDG.ProductionChain.selector);
            new MockUSDG();
            vm.expectRevert(MockSwapRouter.ProductionChain.selector);
            new MockSwapRouter();
            vm.expectRevert(MockAggregatorV3.ProductionChain.selector);
            new MockAggregatorV3(8, 1);
        }
    }

    function test_mockBrandAsset_onlyOwnerMints() public {
        vm.prank(alice);
        vm.expectRevert();
        mNKE.mint(alice, 1);
    }

    // --- no PII in storage/events: claim carries only hashes and amounts -------------

    function test_onChainClaimRecord_isHashOnly() public {
        PurchaseClaim memory c = _claim(alice, 2_000_00);
        (bytes32 id,) = _submit(c);
        // The only per-claim storage is nullifier -> claimId.
        assertEq(registry.claimOfNullifier(registry.nullifierOf(c)), id);
    }
}
